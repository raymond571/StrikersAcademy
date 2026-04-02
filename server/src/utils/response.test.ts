import { describe, it, expect } from 'vitest';
import { success, paginated } from './response';

describe('success()', () => {
  it('wraps data in success envelope', () => {
    const result = success({ user: { id: '1' } });
    expect(result).toEqual({
      success: true,
      data: { user: { id: '1' } },
    });
  });

  it('includes message when provided', () => {
    const result = success({ id: '1' }, 'Created');
    expect(result).toEqual({
      success: true,
      data: { id: '1' },
      message: 'Created',
    });
  });

  it('omits message when not provided', () => {
    const result = success('hello');
    expect(result).not.toHaveProperty('message');
  });

  it('handles null data', () => {
    const result = success(null);
    expect(result).toEqual({ success: true, data: null });
  });
});

describe('paginated()', () => {
  it('returns data with pagination info', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const result = paginated(items, 1, 10, 25);
    expect(result).toEqual({
      success: true,
      data: items,
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    });
  });

  it('calculates totalPages correctly for exact division', () => {
    const result = paginated([], 1, 10, 20);
    expect(result.pagination.totalPages).toBe(2);
  });

  it('calculates totalPages correctly for zero items', () => {
    const result = paginated([], 1, 10, 0);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('calculates totalPages correctly for single item', () => {
    const result = paginated([{ id: '1' }], 1, 10, 1);
    expect(result.pagination.totalPages).toBe(1);
  });
});
