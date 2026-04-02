import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../app';
import type { FastifyInstance } from 'fastify';

const mockPrisma = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  facility: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  },
  slot: { findMany: vi.fn().mockResolvedValue([]) },
  availabilityBlock: { findMany: vi.fn().mockResolvedValue([]) },
};

vi.mock('../plugins/prisma', () => {
  const fp = require('fastify-plugin');
  return {
    prismaPlugin: fp(async (app: any) => {
      app.decorate('prisma', mockPrisma);
      app.addHook('onClose', async () => {});
    }),
  };
});

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/facilities', () => {
  it('returns 200 and a list (public endpoint)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/facilities',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });
});

describe('GET /api/facilities/:id/slots', () => {
  it('returns 400 without date query param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/facilities/fac-1/slots',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid date format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/facilities/fac-1/slots?date=04-10-2026',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/facilities', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/facilities',
      payload: { name: 'Net 1', type: 'NET', pricePerSlot: 500 },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /api/facilities/:id', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/facilities/fac-1',
      payload: { name: 'Updated' },
    });
    expect(res.statusCode).toBe(401);
  });
});
