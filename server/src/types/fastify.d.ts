import { Role } from '@prisma/client';

// Extend Fastify's JWT payload type
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      email: string;
      role: Role;
    };
    user: {
      id: string;
      email: string;
      role: Role;
    };
  }
}
