import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';

// Mock password utils
vi.mock('../utils/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('salt:hashedkey'),
  verifyPassword: vi.fn(),
}));

import { verifyPassword } from '../utils/password';

function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  } as any;
}

const validRegisterData = {
  name: 'Arul',
  email: 'arul@test.com',
  phone: '9876543210',
  age: 25,
  password: 'password123',
};

describe('AuthService.register', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    vi.clearAllMocks();
  });

  it('creates a user and returns sanitised data (no password)', async () => {
    prisma.user.findUnique.mockResolvedValue(null); // no existing user
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      name: 'Arul',
      email: 'arul@test.com',
      phone: '9876543210',
      age: 25,
      role: 'CUSTOMER',
      password: 'salt:hashedkey',
      createdAt: new Date('2026-01-01'),
    });

    const result = await AuthService.register(prisma, validRegisterData);

    expect(result).toEqual({
      id: 'u1',
      name: 'Arul',
      email: 'arul@test.com',
      phone: '9876543210',
      age: 25,
      role: 'CUSTOMER',
      createdAt: new Date('2026-01-01'),
    });
    expect(result).not.toHaveProperty('password');
  });

  it('rejects invalid Indian phone number', async () => {
    await expect(
      AuthService.register(prisma, { ...validRegisterData, phone: '1234567890' }),
    ).rejects.toThrow('valid 10-digit Indian mobile number');
  });

  it('rejects phone with less than 10 digits', async () => {
    await expect(
      AuthService.register(prisma, { ...validRegisterData, phone: '98765' }),
    ).rejects.toThrow('valid 10-digit Indian mobile number');
  });

  it('rejects password shorter than 6 characters', async () => {
    await expect(
      AuthService.register(prisma, { ...validRegisterData, password: '12345' }),
    ).rejects.toThrow('at least 6 characters');
  });

  it('rejects name shorter than 2 characters', async () => {
    await expect(
      AuthService.register(prisma, { ...validRegisterData, name: 'A' }),
    ).rejects.toThrow('at least 2 characters');
  });

  it('rejects name that is only whitespace', async () => {
    await expect(
      AuthService.register(prisma, { ...validRegisterData, name: '   ' }),
    ).rejects.toThrow('at least 2 characters');
  });

  it('rejects age below 5', async () => {
    await expect(
      AuthService.register(prisma, { ...validRegisterData, age: 3 }),
    ).rejects.toThrow('between 5 and 120');
  });

  it('rejects age above 120', async () => {
    await expect(
      AuthService.register(prisma, { ...validRegisterData, age: 150 }),
    ).rejects.toThrow('between 5 and 120');
  });

  it('rejects duplicate phone number with 409', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' }); // phone exists

    await expect(
      AuthService.register(prisma, validRegisterData),
    ).rejects.toThrow('phone number already exists');
  });

  it('rejects duplicate email with 409', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // phone check — not found
      .mockResolvedValueOnce({ id: 'existing' }); // email check — found

    await expect(
      AuthService.register(prisma, validRegisterData),
    ).rejects.toThrow('email already exists');
  });

  it('lowercases and trims email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1', name: 'Arul', email: 'arul@test.com', phone: '9876543210',
      age: 25, role: 'CUSTOMER', password: 'x', createdAt: new Date(),
    });

    await AuthService.register(prisma, {
      ...validRegisterData,
      email: '  Arul@Test.COM  ',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'arul@test.com' }),
      }),
    );
  });
});

describe('AuthService.login', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    vi.clearAllMocks();
  });

  it('returns sanitised user on valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', name: 'Arul', email: 'arul@test.com', phone: '9876543210',
      age: 25, role: 'CUSTOMER', password: 'salt:hash', createdAt: new Date('2026-01-01'),
    });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const result = await AuthService.login(prisma, { phone: '9876543210', password: 'pass' });
    expect(result.id).toBe('u1');
    expect(result).not.toHaveProperty('password');
  });

  it('throws 401 for non-existent phone (no enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      AuthService.login(prisma, { phone: '9876543210', password: 'pass' }),
    ).rejects.toThrow('Invalid phone number or password');
  });

  it('throws 401 for wrong password (same message as missing user)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', password: 'salt:hash',
    });
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(
      AuthService.login(prisma, { phone: '9876543210', password: 'wrong' }),
    ).rejects.toThrow('Invalid phone number or password');
  });
});

describe('AuthService.getById', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    vi.clearAllMocks();
  });

  it('returns sanitised user when found', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', name: 'Arul', email: 'arul@test.com', phone: '9876543210',
      age: 25, role: 'CUSTOMER', password: 'salt:hash', createdAt: new Date(),
    });

    const result = await AuthService.getById(prisma, 'u1');
    expect(result.id).toBe('u1');
    expect(result).not.toHaveProperty('password');
  });

  it('throws 404 when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(AuthService.getById(prisma, 'nonexistent')).rejects.toThrow('User not found');
  });
});
