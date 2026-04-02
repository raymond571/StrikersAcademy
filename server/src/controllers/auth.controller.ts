/**
 * AuthController — handles registration, login, and profile retrieval.
 * Business logic lives in AuthService.
 */
import { FastifyReply, FastifyRequest } from 'fastify';

export class AuthController {
  static async register(request: FastifyRequest, reply: FastifyReply) {
    // TODO: validate body with zod, delegate to AuthService.register
    throw new Error('Not implemented');
  }

  static async login(request: FastifyRequest, reply: FastifyReply) {
    // TODO: validate body, delegate to AuthService.login, set JWT cookie
    throw new Error('Not implemented');
  }

  static async me(request: FastifyRequest, reply: FastifyReply) {
    // TODO: fetch user from DB by request.user.id, return sanitised profile
    throw new Error('Not implemented');
  }
}
