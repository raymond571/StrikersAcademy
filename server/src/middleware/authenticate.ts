import { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '@strikers/shared';

/** Verifies JWT from httpOnly cookie. Attach to any protected route. */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({
      success: false,
      error: 'Unauthorised — please log in',
      statusCode: 401,
    });
  }
}

/**
 * Require one or more specific roles.
 * Must be used after authenticate in the preHandler chain.
 *
 * Usage:
 *   preHandler: [authenticate, requireRole('ADMIN')]
 *   preHandler: [authenticate, requireRole('ADMIN', 'STAFF')]
 */
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user as { role: UserRole };
    if (!roles.includes(user.role)) {
      reply.status(403).send({
        success: false,
        error: 'Forbidden — insufficient permissions',
        statusCode: 403,
      });
    }
  };
}

/** Convenience guard: ADMIN or STAFF (receptionist). */
export const requireStaffOrAdmin = requireRole('ADMIN', 'STAFF');

/** Convenience guard: ADMIN only. */
export const requireAdmin = requireRole('ADMIN');
