import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type { User, UserRole } from '@strikers/shared';
import { authApi } from '../services/api';

/**
 * Single source of truth for role-based home route.
 * Add new roles here as needed — every redirect in the app uses this.
 */
const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin',
  STAFF: '/admin',
};
const DEFAULT_HOME = '/dashboard';

export function getHomeRoute(role?: UserRole | string): string {
  return (role && ROLE_HOME[role]) || DEFAULT_HOME;
}

/** Roles that can access the admin panel */
export function isAdminRole(role?: string): boolean {
  return role === 'ADMIN' || role === 'STAFF';
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    password: string;
  }) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check if we have a valid session (JWT cookie)
  useEffect(() => {
    authApi
      .me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const { user } = await authApi.login(phone, password);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const register = useCallback(
    async (data: { name: string; email: string; phone: string; dateOfBirth: string; password: string }) => {
      const { user } = await authApi.register(data);
      setUser(user);
      return user;
    },
    [],
  );

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
