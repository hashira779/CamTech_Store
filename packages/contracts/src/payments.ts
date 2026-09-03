import { z } from 'zod';
import { PAYMENT_METHODS } from './sales';
import { CURRENCIES } from './products';

// ---------------------------------------------------------------------------
// Constants & Enums
// ---------------------------------------------------------------------------

export const PAYMENT_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PROVIDERS = [
  'CASH',
  'BAKONG_KHQR',
  'CARD_STRIPE',
  'BANK_TRANSFER',
  'MANUAL',
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const createPaymentIntentSchema = z.object({
  saleId: z.string().optional().nullable(),
  method: z.enum(PAYMENT_METHODS).optional().default('QR'),
  provider: z.enum(PAYMENT_PROVIDERS).optional().default('BAKONG_KHQR'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  currency: z.enum(CURRENCIES).optional().default('USD'),
  billNumber: z.string().max(50).optional().nullable(),
  merchantName: z.string().max(100).optional().nullable(),
  merchantCity: z.string().max(100).optional().nullable(),
  accountInformation: z.string().max(100).optional().nullable(),
});

export type CreatePaymentIntentInput = z.input<typeof createPaymentIntentSchema>;

export const paymentWebhookSchema = z.object({
  transactionId: z.string().min(1),
  status: z.enum(PAYMENT_STATUSES),
  amount: z.number().positive(),
  currency: z.enum(CURRENCIES).default('USD'),
  externalReference: z.string().optional().nullable(),
  hash: z.string().optional().nullable(),
});

export type PaymentWebhookPayload = z.infer<typeof paymentWebhookSchema>;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface PaymentIntentDto {
  paymentId: string;
  saleId: string | null;
  status: PaymentStatus;
  method: string;
  provider: string;
  amount: number;
  currency: string;
  qrString?: string | null;
  reference?: string | null;
  createdAt: string;
}

export interface PaymentVerificationDto {
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  reference?: string | null;
  paidAt?: string | null;
}
