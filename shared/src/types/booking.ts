export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED' | 'REFUNDED';
export type BookingFor = 'SELF' | 'CHILD' | 'TEAM';
export type PaymentMethod = 'ONLINE' | 'OFFLINE';

export interface Booking {
  id: string;
  userId: string;
  slotId: string;
  batchId: string | null;
  status: BookingStatus;
  bookingFor: BookingFor;
  playerName: string | null;
  teamName: string | null;
  paymentMethod: PaymentMethod;
  couponId: string | null;
  discountPaise: number | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  slot?: import('./slot').Slot;
  payment?: import('./payment').Payment;
}

export interface CreateBookingPayload {
  slotId: string;
  bookingFor?: BookingFor;
  playerName?: string;
  teamName?: string;
  paymentMethod?: PaymentMethod;
  couponCode?: string;
  notes?: string;
}

/** Used by admin/staff to create a manual booking for any user */
export interface AdminCreateBookingPayload extends CreateBookingPayload {
  userId: string;
}

export interface UpdateBookingStatusPayload {
  status: BookingStatus;
  notes?: string;
}
