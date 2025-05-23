"use client";
import Header from '../../components/Header';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const [form, setForm] = useState({ username: '', email: '', password: '', is_admin: false });
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState<'create' | 'manage'>('create');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if user is admin by fetching session info
    async function checkAdmin() {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.valid || !data.user?.is_admin) {
        router.replace('/'); // Redirect non-admins to home
      }
    }
    checkAdmin();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) {
      setMessage('User created successfully!');
      setForm({ username: '', email: '', password: '', is_admin: false });
    } else {
      setMessage(data.message || 'Failed to create user');
    }
  };

  // Fetch users when switching to manage section
  const fetchUsers = async () => {
    setLoadingUsers(true);
    setUsersError('');
    try {
      const res = await fetch('/api/admin/list-users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setUsersError(data.message || 'Failed to fetch users');
      }
    } catch (err) {
      setUsersError('Failed to fetch users');
    } finally {
      setLoadingUsers(false);
    }
  };

  return (
    <>
      <Header />
      <main className="flex flex-col min-h-screen bg-black text-white">
        <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl mx-auto mt-12">
          {/* Sidebar for admin navigation (future features) */}
          <aside className="w-full md:w-1/4 bg-black/80 border border-white rounded-lg shadow-lg p-6 flex flex-col gap-4 mb-8 md:mb-0">
            <h2 className="text-xl font-bold mb-4 text-white">Admin Menu</h2>
            <nav className="flex flex-col gap-2">
              <button
                className={`text-left p-2 rounded transition-colors font-medium border border-white ${activeSection === 'create' ? 'bg-white/10' : 'hover:bg-white/10'} text-white`}
                onClick={() => setActiveSection('create')}
              >
                Create User
              </button>
              <button
                className={`text-left p-2 rounded transition-colors font-medium border border-white ${activeSection === 'manage' ? 'bg-white/10' : 'hover:bg-white/10'} text-white`}
                onClick={() => {
                  setActiveSection('manage');
                  fetchUsers();
                }}
              >
                Manage Users
              </button>
              <button className="text-left p-2 rounded hover:bg-white/10 transition-colors font-medium text-white border border-white">Site Analytics</button>
            </nav>
          </aside>

          {/* Main admin content area */}
          <section className="flex-1 bg-black/80 border border-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold mb-8 text-center">Administrator Dashboard</h1>
            {activeSection === 'create' && (
              <div className="bg-black/80 text-white rounded-lg shadow p-6 mb-8">
                <h2 className="text-xl font-bold mb-4">Create New User</h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={form.username}
                    onChange={handleChange}
                    className="p-2 bg-black text-white border border-white rounded focus:outline-none"
                    required
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={handleChange}
                    className="p-2 bg-black text-white border border-white rounded focus:outline-none"
                    required
                  />
                  <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                    className="p-2 bg-black text-white border border-white rounded focus:outline-none"
                    required
                  />
                  <label className="flex items-center text-white">
                    <input
                      type="checkbox"
                      name="is_admin"
                      checked={form.is_admin}
                      onChange={handleChange}
                      className="mr-2"
                    />
                    Admin
                  </label>
                  <button type="submit" className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors">
                    Create User
                  </button>
                  {message && <div className="text-center mt-2 text-green-400">{message}</div>}
                </form>
              </div>
            )}
            {activeSection === 'manage' && (
              <div className="bg-black/80 text-white rounded-lg shadow p-6 mb-8">
                <h2 className="text-xl font-bold mb-4">Manage Users</h2>
                {loadingUsers ? (
                  <div>Loading users...</div>
                ) : usersError ? (
                  <div className="text-red-400">{usersError}</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="border-b border-white p-2">Username</th>
                        <th className="border-b border-white p-2">Email</th>
                        <th className="border-b border-white p-2">Admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user._id} className="hover:bg-white/10">
                          <td className="p-2">{user.username}</td>
                          <td className="p-2">{user.email}</td>
                          <td className="p-2">{user.is_admin ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {/* Placeholder for future admin widgets/features */}
            <div className="bg-black/60 border border-white rounded-lg p-6 text-white text-center">
              <p className="text-lg">More admin features coming soon...</p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
