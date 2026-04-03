import { FastifyPluginAsync } from 'fastify';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/auth/register
   * Body: { name, phone, password }
   */
  fastify.post('/register', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  }, AuthController.register);

  /**
   * POST /api/auth/login
   * Body: { phone, password }
   * Sets httpOnly cookie with JWT on success
   */
  fastify.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, AuthController.login);

  /**
   * POST /api/auth/logout
   * Clears the auth cookie
   */
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { success: true, message: 'Logged out successfully' };
  });

  /**
   * GET /api/auth/me
   * Returns current authenticated user's profile
   */
  fastify.get('/me', { preHandler: [authenticate] }, AuthController.me);
};

export default authRoutes;
