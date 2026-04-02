import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from './useAuth';

// Mock the API module
vi.mock('../services/api', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  },
}));

import { authApi } from '../services/api';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when used outside AuthProvider', () => {
    // Suppress console.error for expected error
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');
  });

  it('starts in loading state and fetches user on mount', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'u1', name: 'Arul', email: 'a@t.com', phone: '9876543210',
      age: 25, role: 'CUSTOMER', createdAt: '2026-01-01',
    } as any);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(
      expect.objectContaining({ id: 'u1', name: 'Arul' }),
    );
  });

  it('sets user to null when session check fails', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('login sets user on success', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('no session'));
    vi.mocked(authApi.login).mockResolvedValue({
      user: { id: 'u1', name: 'Arul', role: 'CUSTOMER' },
    } as any);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login('9876543210', 'password');
    });

    expect(result.current.user).toEqual(
      expect.objectContaining({ id: 'u1' }),
    );
  });

  it('logout clears user', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'u1', name: 'Arul', role: 'CUSTOMER',
    } as any);
    vi.mocked(authApi.logout).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
  });

  it('register sets user on success', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('no session'));
    vi.mocked(authApi.register).mockResolvedValue({
      user: { id: 'u2', name: 'New User', role: 'CUSTOMER' },
    } as any);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.register({
        name: 'New User',
        email: 'new@test.com',
        phone: '9876543210',
        age: 20,
        password: 'pass123',
      });
    });

    expect(result.current.user).toEqual(
      expect.objectContaining({ id: 'u2', name: 'New User' }),
    );
  });
});
