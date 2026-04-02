/** Generic API success response envelope */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/** Generic API error response envelope */
export interface ApiError {
  success: false;
  error: string;
  statusCode: number;
  details?: unknown;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
