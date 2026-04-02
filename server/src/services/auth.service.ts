/**
 * AuthService — user registration, login, and profile retrieval.
 * All business logic lives here; the controller handles HTTP concerns.
 */
import { PrismaClient } from '@prisma/client';
import type { UserRole } from '@strikers/shared';
import { hashPassword, verifyPassword } from '../utils/password';

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  age: number;
  password: string;
}

export interface LoginInput {
  phone: string;
  password: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  role: UserRole;
  createdAt: Date;
}

/** Strip password from user record before returning to client */
function sanitise(user: {
  id: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  role: string;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    age: user.age,
    role: user.role as UserRole,
    createdAt: user.createdAt,
  };
}

/** Throw an HTTP-aware error */
function httpError(message: string, statusCode: number): never {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  throw err;
}

export const AuthService = {
  async register(prisma: PrismaClient, data: RegisterInput): Promise<SafeUser> {
    // Validate 10-digit Indian mobile number
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(data.phone)) {
      httpError('Phone number must be a valid 10-digit Indian mobile number', 400);
    }

    if (data.password.length < 6) {
      httpError('Password must be at least 6 characters', 400);
    }

    if (data.name.trim().length < 2) {
      httpError('Name must be at least 2 characters', 400);
    }

    if (data.age < 5 || data.age > 120) {
      httpError('Age must be between 5 and 120', 400);
    }

    // Check phone uniqueness
    const existingPhone = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existingPhone) {
      httpError('An account with this phone number already exists', 409);
    }

    // Check email uniqueness
    const existingEmail = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
    if (existingEmail) {
      httpError('An account with this email already exists', 409);
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        phone: data.phone,
        age: data.age,
        password: hashedPassword,
        role: 'CUSTOMER',
      },
    });

    return sanitise(user);
  },

  async login(prisma: PrismaClient, data: LoginInput): Promise<SafeUser> {
    const user = await prisma.user.findUnique({ where: { phone: data.phone } });

    // Use same error message for both missing user and wrong password
    // to prevent phone enumeration
    if (!user) {
      httpError('Invalid phone number or password', 401);
    }

    const passwordValid = await verifyPassword(data.password, user!.password);
    if (!passwordValid) {
      httpError('Invalid phone number or password', 401);
    }

    return sanitise(user!);
  },

  async getById(prisma: PrismaClient, id: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      httpError('User not found', 404);
    }

    return sanitise(user!);
  },
};
