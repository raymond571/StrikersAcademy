/**
 * AuthController — handles registration, login, logout, and profile retrieval.
 * Business logic lives in AuthService; this layer handles HTTP req/reply only.
 */
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { success } from '../utils/response';

// ── Validation schemas ────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address').max(255),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number'),
  age: z
    .number({ required_error: 'Age is required', invalid_type_error: 'Age must be a number' })
    .int('Age must be a whole number')
    .min(5, 'Age must be at least 5')
    .max(120, 'Age must be at most 120'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

const loginSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(1, 'Password is required'),
});

// ── Controller ────────────────────────────────────────────────

export class AuthController {
  /**
   * POST /api/auth/register
   * Body: { name, email, phone, age, password }
   */
  static async register(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = registerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const user = await AuthService.register(request.server.prisma, parseResult.data);

    // Issue JWT — payload carried in httpOnly cookie
    const token = await reply.jwtSign(
      { id: user.id, phone: user.phone, role: user.role },
      { expiresIn: '7d' },
    );

    reply
      .setCookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
      })
      .status(201);

    return success({ user }, 'Account created successfully');
  }

  /**
   * POST /api/auth/login
   * Body: { phone, password }
   * Sets httpOnly cookie with JWT on success
   */
  static async login(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const user = await AuthService.login(request.server.prisma, parseResult.data);

    const token = await reply.jwtSign(
      { id: user.id, phone: user.phone, role: user.role },
      { expiresIn: '7d' },
    );

    reply.setCookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return success({ user }, 'Logged in successfully');
  }

  /**
   * GET /api/auth/me
   * Returns current authenticated user's profile (no password).
   * Requires authenticate middleware.
   */
  static async me(request: FastifyRequest, reply: FastifyReply) {
    const user = await AuthService.getById(request.server.prisma, request.user.id);
    return success({ user });
  }
}
