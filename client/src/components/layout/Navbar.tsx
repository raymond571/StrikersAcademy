import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-brand-600">
              Strikers<span className="text-pitch-600">Academy</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-gray-600 hover:text-brand-600"
                >
                  Dashboard
                </Link>
                <Link
                  to="/booking"
                  className="text-sm font-medium text-gray-600 hover:text-brand-600"
                >
                  Book a Slot
                </Link>
                {user.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Admin
                  </Link>
                )}
                <button onClick={handleLogout} className="btn-secondary text-xs">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-secondary text-xs">
                  Login
                </Link>
                <Link to="/register" className="btn-primary text-xs">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
