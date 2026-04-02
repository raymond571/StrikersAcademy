import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../hooks/useAuth';

function renderWithRouter(initialRoute = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, isLoading: true, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders protected content when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', name: 'Test', role: 'CUSTOMER' } as any,
      isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
