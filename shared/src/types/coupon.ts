export type DiscountType = 'FIXED' | 'PERCENT';

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  /** Paise for FIXED; basis points (100 = 1%) for PERCENT */
  discountValue: number;
  maxUsage: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
}

export interface CreateCouponPayload {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxUsage?: number;
  validFrom: string;
  validUntil?: string;
}

/** Returned by POST /api/bookings/validate-coupon */
export interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  discountPaise?: number;
  error?: string;
}
