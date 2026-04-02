import { useState, FormEvent } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth, getHomeRoute } from '../hooks/useAuth';
import { Layout } from '../components/layout/Layout';

export default function RegisterPage() {
  const { user, isLoading, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    age: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already logged in — redirect based on role (after all hooks)
  if (!isLoading && user) {
    return <Navigate to={getHomeRoute(user.role)} replace />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const registeredUser = await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        age: parseInt(form.age, 10),
        password: form.password,
      });
      navigate(getHomeRoute(registeredUser.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Create your account
        </h1>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="label">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              className="input"
              placeholder="Ravi Kumar"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              placeholder="ravi@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="label">Phone (10 digits)</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="input"
              placeholder="9876543210"
              pattern="[6-9][0-9]{9}"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label htmlFor="age" className="label">Age</label>
            <input
              id="age"
              name="age"
              type="number"
              className="input"
              placeholder="22"
              min={5}
              max={120}
              value={form.age}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              placeholder="Min 6 characters"
              minLength={6}
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </Layout>
  );
}
