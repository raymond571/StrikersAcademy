/**
 * PaymentService — wraps Razorpay SDK.
 * Supports test mode (rzp_test_ keys) automatically via Razorpay SDK.
 */
import Razorpay from 'razorpay';
import { createHmac } from 'crypto';

let razorpay: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    }

    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpay;
}

export const PaymentService = {
  /**
   * Create a Razorpay order.
   * @param amountPaise - Amount in paise (₹1 = 100 paise)
   * @param receiptId - Unique reference (booking ID)
   */
  async createOrder(amountPaise: number, receiptId: string) {
    const instance = getRazorpay();
    const order = await instance.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: receiptId,
    });
    return order;
  },

  /**
   * Verify Razorpay payment signature (HMAC-SHA256).
   * Call this after the customer completes checkout.
   */
  verifySignature(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;
    const keySecret = process.env.RAZORPAY_KEY_SECRET ?? '';
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');
    return expectedSignature === razorpaySignature;
  },

  /**
   * Issue a full refund for a Razorpay payment.
   * @param paymentId - Razorpay payment ID (pay_xxx)
   * @param amountPaise - Amount to refund in paise (full refund if omitted)
   */
  async refund(paymentId: string, amountPaise?: number) {
    const instance = getRazorpay();
    const refund = await (instance.payments as any).refund(paymentId, {
      ...(amountPaise ? { amount: amountPaise } : {}),
    });
    return refund;
  },

  /**
   * Fetch payment details from Razorpay for cross-verification.
   * @param paymentId - Razorpay payment ID (pay_xxx)
   */
  async fetchPayment(paymentId: string) {
    const instance = getRazorpay();
    return (instance.payments as any).fetch(paymentId);
  },

  /**
   * Fetch all payments for an order from Razorpay.
   * @param orderId - Razorpay order ID (order_xxx)
   */
  async fetchOrderPayments(orderId: string) {
    const instance = getRazorpay();
    return instance.orders.fetchPayments(orderId);
  },

  /**
   * Verify webhook payload signature.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    return expectedSignature === signature;
  },
};
