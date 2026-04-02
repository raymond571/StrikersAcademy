import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute } from './AdminRoute';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../hooks/useAuth';

function renderWithRouter(initialRoute = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<div>Admin Panel</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminRoute', () => {
  it('shows loading spinner while auth is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, isLoading: true, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders admin content when user is ADMIN', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', name: 'Admin', role: 'ADMIN' } as any,
      isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects CUSTOMER to /dashboard', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', name: 'User', role: 'CUSTOMER' } as any,
      isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('redirects STAFF to /dashboard', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', name: 'Staff', role: 'STAFF' } as any,
      isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});
