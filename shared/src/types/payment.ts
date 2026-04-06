export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface Payment {
  id: string;
  bookingId: string;
  /** Amount in paise after discount (e.g., 50000 = ₹500) */
  amount: number;
  /** "ONLINE" | "OFFLINE" */
  method: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

/** Returned when initiating an online payment — used to open Razorpay checkout */
export interface InitiatePaymentResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  bookingId: string;
}

/** Sent from client after Razorpay checkout success */
export interface VerifyPaymentPayload {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  bookingId: string;
  batchId?: string;
}
