import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../app';
import type { FastifyInstance } from 'fastify';

// Mock Prisma to avoid real DB connection
vi.mock('../plugins/prisma', () => ({
  prismaPlugin: async (app: any) => {
    app.decorate('prisma', {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
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

describe('POST /api/auth/register', () => {
  it('returns 400 for empty body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Validation');
  });

  it('returns 400 for invalid phone format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Test User',
        email: 'test@test.com',
        phone: '1234',
        age: 25,
        password: 'password123',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Test',
        phone: '9876543210',
        age: 25,
        password: 'password123',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Test User',
        email: 'test@test.com',
        phone: '9876543210',
        age: 25,
        password: '12345',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid age (below 5)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Test User',
        email: 'test@test.com',
        phone: '9876543210',
        age: 2,
        password: 'password123',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 400 for empty body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { phone: '9876543210' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /health', () => {
  it('returns 200 with health info', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('StrikersAcademy API');
  });
});
