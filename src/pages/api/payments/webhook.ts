import crypto from 'node:crypto';
import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../db';
import { payments, users } from '../../../db/schema';
import { logSecurityEvent } from '../../../lib/audit';
import { paymentWebhookSchema } from '../../../lib/validation';

const REPLAY_WINDOW_SECONDS = 300; // 5 minutes

function getPaymentSecret(): string {
  const secret = process.env.PAYMENT_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error('PAYMENT_SECRET must be set and at least 24 characters long');
  }
  return secret;
}

function verifyWebhookSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
): boolean {
  if (!timestampHeader || !signatureHeader) return false;
  if (!/^\d+$/.test(timestampHeader)) return false;

  const timestamp = Number.parseInt(timestampHeader, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > REPLAY_WINDOW_SECONDS) {
    return false;
  }

  const providedHex = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader;

  if (!/^[0-9a-f]{64}$/i.test(providedHex)) {
    return false;
  }

  const expectedHex = crypto
    .createHmac('sha256', getPaymentSecret())
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(providedHex, 'hex'),
    Buffer.from(expectedHex, 'hex'),
  );
}

/**
 * Server-to-server payment provider webhook.
 * Only a cryptographically signed callback using PAYMENT_SECRET can transition
 * a pending payment intent to `paid` and grant `users.isPremium = true`.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const rawBody = await request.text();
  const timestampHeader = request.headers.get('x-payment-timestamp');
  const signatureHeader = request.headers.get('x-payment-signature');

  if (!verifyWebhookSignature(rawBody, timestampHeader, signatureHeader)) {
    logSecurityEvent('payment.webhook_rejected', {
      reason: 'invalid_signature_or_timestamp',
      ip: clientAddress,
    });
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    logSecurityEvent('payment.webhook_rejected', {
      reason: 'invalid_json',
      ip: clientAddress,
    });
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = paymentWebhookSchema.safeParse(parsedJson);
  if (!parsed.success) {
    logSecurityEvent('payment.webhook_rejected', {
      reason: 'schema_validation_failed',
      ip: clientAddress,
    });
    return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { eventId, paymentId, status, amountVnd } = parsed.data;

  const outcome = await db.transaction(async (tx) => {
    // Idempotency: ignore already-processed webhook event IDs
    const [existingEvent] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.webhookEventId, eventId))
      .limit(1);

    if (existingEvent) {
      return { kind: 'duplicate' as const };
    }

    const [updated] = await tx
      .update(payments)
      .set({
        status,
        webhookEventId: eventId,
        paidAt: status === 'paid' ? new Date() : null,
      })
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.status, 'pending'),
          eq(payments.amountVnd, amountVnd),
        ),
      )
      .returning({ id: payments.id, userId: payments.userId });

    if (!updated) {
      return { kind: 'not_found_or_mismatch' as const };
    }

    if (status === 'paid' && updated.userId) {
      await tx
        .update(users)
        .set({ isPremium: true })
        .where(and(eq(users.id, updated.userId), eq(users.isPremium, false)));
    }

    return { kind: 'processed' as const, userId: updated.userId };
  });

  if (outcome.kind === 'not_found_or_mismatch') {
    logSecurityEvent('payment.webhook_rejected', {
      reason: 'payment_not_pending_or_amount_mismatch',
      paymentId,
      eventId,
    });
    return new Response(
      JSON.stringify({ error: 'Pending payment not found or amount mismatch' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  logSecurityEvent('payment.webhook_verified', {
    eventId,
    paymentId,
    status,
    outcome: outcome.kind,
    userId: outcome.kind === 'processed' ? outcome.userId : null,
  });

  return new Response(JSON.stringify({ ok: true, outcome: outcome.kind }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
