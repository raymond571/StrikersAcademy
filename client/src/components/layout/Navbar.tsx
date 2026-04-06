import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, isAdminRole } from '../../hooks/useAuth';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { canInstall, install } = usePWAInstall();

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0" onClick={closeMenu}>
            <span className="text-lg font-bold text-brand-600">
              Strikers<span className="text-pitch-600">Academy</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-4">
            {user ? (
              <>
                <Link to="/dashboard" className="text-sm font-medium text-gray-600 hover:text-brand-600">
                  Dashboard
                </Link>
                <Link to="/booking" className="text-sm font-medium text-gray-600 hover:text-brand-600">
                  Book a Slot
                </Link>
                {isAdminRole(user.role) && (
                  <Link to="/admin" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    Admin
                  </Link>
                )}
                {canInstall && (
                  <button onClick={install} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    Install App
                  </button>
                )}
                <button onClick={handleLogout} className="btn-secondary text-xs">
                  Logout
                </button>
              </>
            ) : (
              <>
                {canInstall && (
                  <button onClick={install} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    Install App
                  </button>
                )}
                <Link to="/login" className="btn-secondary text-xs">Login</Link>
                <Link to="/register" className="btn-primary text-xs">Register</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 text-gray-600 hover:text-brand-600"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-2">
          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Dashboard
              </Link>
              <Link
                to="/booking"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Book a Slot
              </Link>
              {isAdminRole(user.role) && (
                <Link
                  to="/admin"
                  onClick={closeMenu}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
                >
                  Admin Panel
                </Link>
              )}
              {canInstall && (
                <button
                  onClick={() => { install(); closeMenu(); }}
                  className="block w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
                >
                  Install App
                </button>
              )}
              <div className="border-t border-gray-100 pt-2 mt-2">
                <p className="px-3 text-xs text-gray-400">{user.name} ({user.phone})</p>
                <button
                  onClick={handleLogout}
                  className="mt-1 block w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              {canInstall && (
                <button
                  onClick={() => { install(); closeMenu(); }}
                  className="block w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
                >
                  Install App
                </button>
              )}
              <Link
                to="/login"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
              >
                Register
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
