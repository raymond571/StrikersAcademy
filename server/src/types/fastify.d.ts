import type { UserRole } from '@strikers/shared';

// Extend Fastify's JWT payload type
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      phone: string;
      role: UserRole;
    };
    user: {
      id: string;
      phone: string;
      role: UserRole;
    };
  }
}
