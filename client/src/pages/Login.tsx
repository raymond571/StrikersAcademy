import { useState, FormEvent } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth, getHomeRoute } from '../hooks/useAuth';
import { Layout } from '../components/layout/Layout';

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already logged in — redirect based on role (after all hooks)
  if (!isLoading && user) {
    return <Navigate to={getHomeRoute(user.role)} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(phone, password);
      navigate(getHomeRoute(loggedInUser.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Sign in to StrikersAcademy
        </h1>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="phone" className="label">Phone Number</label>
            <input
              id="phone"
              type="tel"
              className="input"
              placeholder="9876543210"
              pattern="[6-9][0-9]{9}"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          No account?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </Layout>
  );
}
