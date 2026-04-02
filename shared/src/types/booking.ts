export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface Booking {
  id: string;
  userId: string;
  slotId: string;
  status: BookingStatus;
  createdAt: string;
  slot?: import('./slot').Slot;
  payment?: import('./payment').Payment;
}

export interface CreateBookingPayload {
  slotId: string;
}

export interface UpdateBookingStatusPayload {
  status: BookingStatus;
}
