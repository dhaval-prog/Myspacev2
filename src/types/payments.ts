export type PaymentAttemptStatus = 'initiated' | 'processing' | 'pending' | 'verified' | 'failed' | 'expired';

/** One payer→recipient UPI payment attempt against a split, tracked server-side. */
export interface PaymentAttempt {
  id: string;
  reference: string;
  splitId: string;
  payerUserId: string;
  recipientUserId: string;
  recipientUpiId: string;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  provider: string;
  upiApp: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
}

/** A user's own UPI receiving profile — `verified` here means "well-formed and ready", not bank-verified. */
export interface UpiProfile {
  userId: string;
  upiId: string | null;
  upiVerified: boolean;
}
