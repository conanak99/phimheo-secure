import { z } from 'zod';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './password';

export const uuidSchema = z.string().uuid();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email tối đa 254 ký tự.')
  .email('Email không hợp lệ.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu.')
    .max(MAX_PASSWORD_LENGTH, `Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự.`),
});

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'Tên người dùng phải có từ 2 đến 40 ký tự.')
    .max(40, 'Tên người dùng phải có từ 2 đến 40 ký tự.')
    .refine(
      (val) => !/[\u0000-\u001f\u007f]/.test(val),
      'Tên người dùng chứa ký tự không hợp lệ.',
    ),
  email: emailSchema,
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Mật khẩu phải có từ ${MIN_PASSWORD_LENGTH} đến ${MAX_PASSWORD_LENGTH} ký tự.`,
    )
    .max(
      MAX_PASSWORD_LENGTH,
      `Mật khẩu phải có từ ${MIN_PASSWORD_LENGTH} đến ${MAX_PASSWORD_LENGTH} ký tự.`,
    ),
});

export const bioSchema = z
  .string()
  .trim()
  .max(500, 'Giới thiệu tối đa 500 ký tự.');

export const commentSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập nội dung bình luận.')
  .max(1000, 'Bình luận tối đa 1000 ký tự.');

export const videoTitleSchema = z.string().trim().min(2).max(160);

export const searchQuerySchema = z.string().trim().max(100);

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const paymentWebhookSchema = z.object({
  eventId: z.string().trim().min(8).max(128),
  paymentId: uuidSchema,
  status: z.enum(['paid', 'failed']),
  amountVnd: z.number().int().positive(),
});

export function sanitizeHexColor(value: string, fallback: string): string {
  return hexColorSchema.safeParse(value).success ? value : fallback;
}
