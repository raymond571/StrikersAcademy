export interface Slot {
  id: string;
  facilityId: string;
  /** ISO date string: YYYY-MM-DD */
  date: string;
  /** 24h format: HH:MM */
  startTime: string;
  /** 24h format: HH:MM */
  endTime: string;
  /** Maximum number of concurrent bookings allowed */
  capacity: number;
  /** Number of confirmed/pending bookings currently held */
  bookedCount: number;
  /** Derived: capacity - bookedCount > 0 */
  isAvailable: boolean;
  /** Price override in paise — null means use facility.pricePerSlot */
  priceOverride: number | null;
  /** Resolved price: priceOverride ?? facility.pricePerSlot */
  effectivePrice?: number;
  facility?: import('./facility').Facility;
}

export interface CreateSlotPayload {
  facilityId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  priceOverride?: number;
}

export interface BulkCreateSlotsPayload {
  facilityId: string;
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  timeSlots: Array<{ startTime: string; endTime: string }>;
  capacity?: number;
}

export interface SlotQueryParams {
  facilityId?: string;
  date?: string;
  availableOnly?: boolean;
}
