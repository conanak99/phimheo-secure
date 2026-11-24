const ALLOWED_FORM_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
];

/**
 * Safely parse FormData from a POST request without throwing unhandled 500s
 * on missing/unsupported Content-Type headers or malformed multipart payloads.
 */
export async function parseFormData(
  request: Request,
): Promise<FormData | null> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  const isForm = ALLOWED_FORM_TYPES.some((type) => contentType.includes(type));
  if (!isForm) {
    return null;
  }

  try {
    return await request.formData();
  } catch {
    return null;
  }
}
