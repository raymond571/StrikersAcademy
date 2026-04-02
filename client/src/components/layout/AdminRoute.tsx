import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, isAdminRole } from '../../hooks/useAuth';

/**
 * Wraps routes that require admin-level access (ADMIN or STAFF).
 * Redirects to /dashboard if authenticated but not an admin role.
 */
export function AdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminRole(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
