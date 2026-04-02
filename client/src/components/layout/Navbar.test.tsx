import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../hooks/useAuth';

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );
}

describe('Navbar', () => {
  it('shows Login and Register links when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderNavbar();
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows Dashboard, Book a Slot, and Logout when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', name: 'Test', role: 'CUSTOMER' } as any,
      isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderNavbar();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Book a Slot')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });

  it('shows Admin link only for ADMIN users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', name: 'Admin', role: 'ADMIN' } as any,
      isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderNavbar();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('does not show Admin link for CUSTOMER users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', name: 'User', role: 'CUSTOMER' } as any,
      isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderNavbar();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('calls logout and navigates to /login on logout click', async () => {
    const mockLogout = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', name: 'Test', role: 'CUSTOMER' } as any,
      isLoading: false, login: vi.fn(), logout: mockLogout, register: vi.fn(),
    });

    renderNavbar();
    await userEvent.click(screen.getByText('Logout'));

    expect(mockLogout).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows StrikersAcademy brand name', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, isLoading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    renderNavbar();
    expect(screen.getByText(/Strikers/)).toBeInTheDocument();
    expect(screen.getByText(/Academy/)).toBeInTheDocument();
  });
});
