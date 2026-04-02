/**
 * AuthService — user registration, login, and token management.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from '../utils/password';

export const AuthService = {
  async register(
    prisma: PrismaClient,
    data: { name: string; email: string; phone: string; password: string },
  ) {
    // TODO: check email uniqueness, hash password, create user record
    throw new Error('Not implemented');
  },

  async login(
    prisma: PrismaClient,
    data: { email: string; password: string },
  ) {
    // TODO: find user by email, verify password, return sanitised user
    throw new Error('Not implemented');
  },
};
