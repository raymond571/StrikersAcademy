import { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '@prisma/client';

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

/** Require ADMIN role. Must be used after authenticate. */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user as { role: Role };
    if (!roles.includes(user.role)) {
      reply.status(403).send({
        success: false,
        error: 'Forbidden — insufficient permissions',
        statusCode: 403,
      });
    }
  };
}
