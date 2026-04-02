import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/authenticate';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/auth/register
   * Body: { name, email, phone, password }
   */
  fastify.post('/register', async (request, reply) => {
    // TODO: implement in AuthController
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * POST /api/auth/login
   * Body: { email, password }
   * Sets httpOnly cookie with JWT on success
   */
  fastify.post('/login', async (request, reply) => {
    // TODO: implement in AuthController
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * POST /api/auth/logout
   * Clears the auth cookie
   */
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    reply.clearCookie('token');
    return { success: true, message: 'Logged out successfully' };
  });

  /**
   * GET /api/auth/me
   * Returns current authenticated user's profile
   */
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    // TODO: implement in AuthController
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });
};

export default authRoutes;
