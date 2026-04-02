export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface Payment {
  id: string;
  bookingId: string;
  /** Amount in paise (e.g., 50000 = ₹500) */
  amount: number;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  status: PaymentStatus;
  createdAt: string;
}

/** Returned when initiating a payment — used to open Razorpay checkout */
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
}
