/** Utility helpers to build consistent API response shapes */

export function success<T>(data: T, message?: string) {
  return {
    success: true as const,
    data,
    ...(message ? { message } : {}),
  };
}

export function paginated<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
) {
  return {
    success: true as const,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
