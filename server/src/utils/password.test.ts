import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password utils', () => {
  it('hashes a password and returns salt:hash format', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toContain(':');
    const [salt, key] = hash.split(':');
    expect(salt).toHaveLength(32); // 16 bytes hex
    expect(key).toHaveLength(128); // 64 bytes hex
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('samepassword');
    const hash2 = await hashPassword('samepassword');
    expect(hash1).not.toBe(hash2);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('correct-password', hash);
    expect(result).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('handles empty password', async () => {
    const hash = await hashPassword('');
    const result = await verifyPassword('', hash);
    expect(result).toBe(true);
  });

  it('handles special characters in password', async () => {
    const password = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('handles unicode characters', async () => {
    const password = 'பாஸ்வேர்ட்123';
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
