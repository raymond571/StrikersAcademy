export interface Slot {
  id: string;
  facilityId: string;
  /** ISO date string: YYYY-MM-DD */
  date: string;
  /** 24h format: HH:MM */
  startTime: string;
  /** 24h format: HH:MM */
  endTime: string;
  isAvailable: boolean;
  facility?: import('./facility').Facility;
}

export interface CreateSlotPayload {
  facilityId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface SlotQueryParams {
  facilityId?: string;
  date?: string;
  availableOnly?: boolean;
}
