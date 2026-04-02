import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';

import { prismaPlugin } from './plugins/prisma';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import bookingRoutes from './routes/booking';
import paymentRoutes from './routes/payment';
import facilityRoutes from './routes/facility';
import adminRoutes from './routes/admin';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    },
  });

  // ── Plugins ────────────────────────────────────────────────
  await app.register(fastifyCors, {
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET ?? 'fallback-secret-change-in-prod',
  });

  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'fallback-jwt-secret-change-in-prod',
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  await app.register(prismaPlugin);

  // ── Error handler ──────────────────────────────────────────
  app.setErrorHandler(errorHandler);

  // ── Health check ───────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    service: 'StrikersAcademy API',
    timestamp: new Date().toISOString(),
  }));

  // ── Routes ─────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(facilityRoutes, { prefix: '/api/facilities' });
  await app.register(bookingRoutes, { prefix: '/api/bookings' });
  await app.register(paymentRoutes, { prefix: '/api/payments' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  return app;
}
