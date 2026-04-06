import { useEffect, useState, useCallback } from 'react';
import { adminApi, type AdminUser } from '../../services/api';

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  STAFF: 'bg-blue-100 text-blue-800',
  CUSTOMER: 'bg-gray-100 text-gray-800',
};

const ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;

interface UserForm {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  password: string;
  role: string;
}

const emptyForm: UserForm = { name: '', email: '', phone: '', dateOfBirth: '', password: '', role: 'CUSTOMER' };

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ page, limit: 20 });
      setUsers(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone,
      dateOfBirth: u.dateOfBirth || '',
      password: '',
      role: u.role,
    });
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.name || !form.email || !form.dateOfBirth) {
      setError('Name, email, and date of birth are required');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const data: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          dateOfBirth: form.dateOfBirth,
          role: form.role,
        };
        if (form.password) data.password = form.password;
        await adminApi.updateUser(editingId, data as any);
      } else {
        if (!form.phone || !form.password) {
          setError('Phone and password are required for new users');
          setSubmitting(false);
          return;
        }
        await adminApi.createUser({
          name: form.name,
          email: form.email,
          phone: form.phone,
          dateOfBirth: form.dateOfBirth,
          password: form.password,
          role: form.role,
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`Delete user "${u.name}" (${u.phone})? This only works if they have no bookings.`)) return;
    try {
      await adminApi.deleteUser(u.id);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Users</h3>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const res = await fetch('/api/admin/users/export', { credentials: 'include' });
              if (!res.ok) { alert('Failed'); return; }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="btn-secondary text-xs"
          >
            Export CSV
          </button>
          <button onClick={openCreate} className="btn-primary text-xs">+ Add User</button>
        </div>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="card space-y-4">
          <h4 className="font-medium text-gray-900">{editingId ? 'Edit User' : 'New User'}</h4>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Ravi Kumar" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" placeholder="ravi@example.com" />
            </div>
            <div>
              <label className="label">Phone (10 digits)</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input"
                placeholder="9876543210"
                pattern="[6-9][0-9]{9}"
                disabled={!!editingId}
              />
              {editingId && <p className="text-xs text-gray-400 mt-1">Phone cannot be changed</p>}
            </div>
            <div>
              <label className="label">Age</label>
              <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="input" max={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="label">{editingId ? 'New Password (leave blank to keep)' : 'Password'}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
                placeholder={editingId ? 'Leave blank to keep current' : 'Min 6 characters'}
                minLength={6}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500">No users found</p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] ?? ''}`}>
                      {u.role}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{u.phone} &middot; {u.email}</p>
                  <p className="text-xs text-gray-400">
                    Age: {u.age}{u.dateOfBirth ? ` (DOB: ${u.dateOfBirth})` : ''} &middot; Bookings: {u._count.bookings} &middot; Joined: {new Date(u.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(u)}
                    className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs">Prev</button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs">Next</button>
        </div>
      )}
    </div>
  );
}
