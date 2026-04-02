import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../app';
import type { FastifyInstance } from 'fastify';

vi.mock('../plugins/prisma', () => ({
  prismaPlugin: async (app: any) => {
    app.decorate('prisma', {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    });
  },
}));

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/bookings', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: { slotId: 'slot-1' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/bookings', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/bookings',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/bookings/:id', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/bookings/some-id',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /api/bookings/:id/cancel', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/some-id/cancel',
    });
    expect(res.statusCode).toBe(401);
  });
});
