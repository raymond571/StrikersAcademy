import fs from 'fs';
import path from 'path';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyHelmet from '@fastify/helmet';

import { prismaPlugin } from './plugins/prisma';
import { errorHandler } from './middleware/errorHandler';
import { validateEnv } from './utils/validateEnv';

import authRoutes from './routes/auth';
import bookingRoutes from './routes/booking';
import paymentRoutes from './routes/payment';
import facilityRoutes from './routes/facility';
import adminRoutes from './routes/admin';

/** Read TLS cert/key files if HTTPS is enabled via env vars */
function getHttpsOptions(): { key: Buffer; cert: Buffer } | undefined {
  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;

  if (!keyPath || !certPath) return undefined;

  const resolvedKey = path.resolve(keyPath);
  const resolvedCert = path.resolve(certPath);

  if (!fs.existsSync(resolvedKey) || !fs.existsSync(resolvedCert)) {
    console.warn(
      `SSL_KEY_PATH or SSL_CERT_PATH not found (${resolvedKey}, ${resolvedCert}). Falling back to HTTP.`,
    );
    return undefined;
  }

  return {
    key: fs.readFileSync(resolvedKey),
    cert: fs.readFileSync(resolvedCert),
  };
}

export async function buildServer() {
  validateEnv();

  const httpsOptions = getHttpsOptions();

  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    },
    // Trust first proxy (Nginx/Cloudflare) so req.ip reflects the real client IP
    trustProxy: process.env.NODE_ENV === 'production',
    ...(httpsOptions ? { https: httpsOptions } : {}),
  });

  // ── Plugins ────────────────────────────────────────────────
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(fastifyCors, {
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
    maxAge: 86400,
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
    https: !!httpsOptions,
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
