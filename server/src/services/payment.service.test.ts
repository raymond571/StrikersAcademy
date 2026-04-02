import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from './payment.service';

describe('PaymentService.verifySignature', () => {
  beforeEach(() => {
    vi.stubEnv('RAZORPAY_KEY_SECRET', 'test-secret-key');
  });

  it('returns true for a valid signature', () => {
    const { createHmac } = require('crypto');
    const body = 'order_123|pay_456';
    const expected = createHmac('sha256', 'test-secret-key').update(body).digest('hex');

    const result = PaymentService.verifySignature({
      razorpayOrderId: 'order_123',
      razorpayPaymentId: 'pay_456',
      razorpaySignature: expected,
    });

    expect(result).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    const result = PaymentService.verifySignature({
      razorpayOrderId: 'order_123',
      razorpayPaymentId: 'pay_456',
      razorpaySignature: 'invalid-signature',
    });

    expect(result).toBe(false);
  });

  it('returns false when secret is empty', () => {
    vi.stubEnv('RAZORPAY_KEY_SECRET', '');

    const result = PaymentService.verifySignature({
      razorpayOrderId: 'order_123',
      razorpayPaymentId: 'pay_456',
      razorpaySignature: 'anything',
    });

    expect(result).toBe(false);
  });
});

describe('PaymentService.verifyWebhookSignature', () => {
  beforeEach(() => {
    vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', 'webhook-secret');
  });

  it('returns true for valid webhook signature', () => {
    const { createHmac } = require('crypto');
    const rawBody = '{"event":"payment.captured"}';
    const expected = createHmac('sha256', 'webhook-secret').update(rawBody).digest('hex');

    const result = PaymentService.verifyWebhookSignature(rawBody, expected);
    expect(result).toBe(true);
  });

  it('returns false for tampered payload', () => {
    const { createHmac } = require('crypto');
    const originalBody = '{"event":"payment.captured"}';
    const tamperedBody = '{"event":"payment.failed"}';
    const sig = createHmac('sha256', 'webhook-secret').update(originalBody).digest('hex');

    const result = PaymentService.verifyWebhookSignature(tamperedBody, sig);
    expect(result).toBe(false);
  });
});
