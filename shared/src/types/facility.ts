export type FacilityType = 'NET' | 'TURF';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  description: string;
  pricePerSlot: number; // in paise (smallest INR unit) for Razorpay compatibility
  isActive: boolean;
}

export interface CreateFacilityPayload {
  name: string;
  type: FacilityType;
  description: string;
  pricePerSlot: number;
}

export interface UpdateFacilityPayload extends Partial<CreateFacilityPayload> {
  isActive?: boolean;
}
