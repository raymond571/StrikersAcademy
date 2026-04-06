import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { paymentApi, bookingApi } from '../services/api';
import type { Booking, InitiatePaymentResponse } from '@strikers/shared';

// Razorpay is loaded via CDN script tag — declare minimal interface
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
}

export default function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId') || undefined;
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [order, setOrder] = useState<(InitiatePaymentResponse & { batchId?: string }) | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'processing' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    Promise.all([
      bookingApi.getById(bookingId),
      paymentApi.initiate(bookingId, batchId),
    ])
      .then(([b, o]) => {
        setBooking(b);
        setOrder(o);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to initiate payment');
        setStatus('error');
      });
  }, [bookingId, batchId]);

  const openRazorpay = () => {
    if (!order || !booking) return;
    setStatus('processing');

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'StrikersAcademy',
      description: batchId ? `Batch ${batchId}` : `Booking ${booking.id}`,
      order_id: order.razorpayOrderId,
      handler: async (response) => {
        try {
          await paymentApi.verify({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            bookingId: bookingId!,
            batchId,
          });
          setStatus('success');
          setTimeout(() => navigate('/dashboard'), 2000);
        } catch {
          setStatus('error');
          setErrorMsg('Payment verification failed. Contact support.');
        }
      },
      theme: { color: '#f97316' },
      modal: {
        ondismiss: () => setStatus('ready'),
      },
    });

    rzp.open();
  };

  return (
    <Layout>
      <div className="mx-auto max-w-md text-center space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Complete Payment</h1>

        {status === 'loading' && <p className="text-gray-500">Preparing your order...</p>}

        {status === 'error' && (
          <div className="card bg-red-50 border-red-200">
            <p className="text-red-700">{errorMsg}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="card bg-pitch-50 border-pitch-100">
            <p className="text-2xl font-bold text-pitch-700">Booking Confirmed!</p>
            <p className="text-gray-600 mt-2">Redirecting to dashboard...</p>
          </div>
        )}

        {(status === 'ready' || status === 'processing') && booking && order && (
          <div className="card space-y-4">
            <div className="text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Facility</span>
                <span className="font-medium">{booking.slot?.facility?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{booking.slot?.date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Time</span>
                <span className="font-medium">
                  {booking.slot?.startTime} – {booking.slot?.endTime}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-brand-600">
                  ₹{(order.amount / 100).toFixed(0)}
                </span>
              </div>
            </div>

            <button
              onClick={openRazorpay}
              disabled={status === 'processing'}
              className="btn-primary w-full text-base py-3"
            >
              {status === 'processing' ? 'Processing...' : 'Pay Now via UPI / Card'}
            </button>

            <p className="text-xs text-gray-400">Powered by Razorpay. Safe & secure.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
