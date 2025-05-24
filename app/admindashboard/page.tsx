"use client";
import Header from '../../components/Header';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  _id?: string;
  user_id: string;
  username: string;
  email: string;
  is_admin: boolean;
  is_banned?: boolean;
}

export default function AdminDashboard() {
  const [form, setForm] = useState({ username: '', email: '', password: '', is_admin: false });
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState<'create' | 'manage' | 'questionnaires'>('create');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [search, setSearch] = useState('');
  const [questionnaireGroups, setQuestionnaireGroups] = useState<any[]>([]);
  const [loadingQuestionnaires, setLoadingQuestionnaires] = useState(false);
  const [questionnairesError, setQuestionnairesError] = useState('');
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
    } catch {
      setUsersError('Failed to fetch users');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Filtered users for search
  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  // Fetch questionnaire groups when switching to questionnaires section
  const fetchQuestionnaireGroups = async () => {
    setLoadingQuestionnaires(true);
    setQuestionnairesError('');
    try {
      const res = await fetch('/api/admin/questionnaires');
      const data = await res.json();
      if (data.success) {
        setQuestionnaireGroups(data.questionnaireGroups);
      } else {
        setQuestionnairesError(data.message || 'Failed to fetch questionnaire groups');
      }
    } catch {
      setQuestionnairesError('Failed to fetch questionnaire groups');
    } finally {
      setLoadingQuestionnaires(false);
    }
  };

  // Ban user handler
  const handleBanUser = async (user_id: string) => {
    const admin_id = users.find((u) => u.is_admin)?.user_id || '';
    if (!window.confirm('Are you sure you want to ban and delete this user?')) return;
    const res = await fetch('/api/admin/ban-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, admin_id }),
    });
    const data = await res.json();
    if (data.success) {
      setUsers((prev) => prev.filter((u) => u.user_id !== user_id));
      alert('User banned and deleted.');
    } else {
      alert(data.message || 'Failed to ban user.');
    }
  };

  // Delete questionnaire group handler
  const handleDeleteQuestionnaireGroup = async (groupId: string) => {
    if (!window.confirm('Are you sure you want to delete this questionnaire group? This will delete all questionnaires and questions within it.')) return;
    const res = await fetch(`/api/admin/questionnaires/${groupId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.success) {
      setQuestionnaireGroups((prev) => prev.filter((g) => g.group_id !== groupId));
      alert('Questionnaire group deleted.');
    } else {
      alert(data.message || 'Failed to delete questionnaire group.');
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
              <button
                className={`text-left p-2 rounded transition-colors font-medium border border-white ${activeSection === 'questionnaires' ? 'bg-white/10' : 'hover:bg-white/10'} text-white`}
                onClick={() => {
                  setActiveSection('questionnaires');
                  fetchQuestionnaireGroups();
                }}
              >
                Manage Questionnaires
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
                <input
                  type="text"
                  placeholder="Search by username or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mb-4 p-2 bg-black text-white border border-white rounded focus:outline-none w-full"
                />
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
                        <th className="border-b border-white p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user._id} className="hover:bg-white/10">
                          <td className="p-2">{user.username}</td>
                          <td className="p-2">{user.email}</td>
                          <td className="p-2">{user.is_admin ? 'Yes' : 'No'}</td>
                          <td className="p-2">
                            <button
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                              onClick={() => handleBanUser(user.user_id)}
                            >
                              Ban
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {activeSection === 'questionnaires' && (
              <div className="bg-black/80 text-white rounded-lg shadow p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Manage Questionnaires</h2>
                  <button 
                    className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
                    onClick={() => window.location.href = '/admindashboard/questionnaires/create'}
                  >
                    Create New Group
                  </button>
                </div>
                {loadingQuestionnaires ? (
                  <div>Loading questionnaire groups...</div>
                ) : questionnairesError ? (
                  <div className="text-red-400">{questionnairesError}</div>
                ) : (
                  <div className="space-y-4">
                    {questionnaireGroups.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        No questionnaire groups found. Create your first group to get started.
                      </div>
                    ) : (
                      questionnaireGroups.map((group) => (
                        <div key={group.group_id} className="border border-white rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="text-lg font-semibold">{group.title}</h3>
                              <p className="text-gray-300 text-sm">{group.description}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                                onClick={() => window.location.href = `/admindashboard/questionnaires/${group.group_id}`}
                              >
                                Manage
                              </button>
                              <button
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                                onClick={() => handleDeleteQuestionnaireGroup(group.group_id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-4 text-sm text-gray-400">
                            <span>Profile Type: <span className="text-white capitalize">{group.profile_type}</span></span>
                            <span>Questionnaires: <span className="text-white">{group.questionnaire_count}</span></span>
                            <span>Created by: <span className="text-white">{group.creator_username || 'Unknown'}</span></span>
                            <span>Status: <span className={group.is_hidden ? 'text-red-400' : 'text-green-400'}>{group.is_hidden ? 'Hidden' : 'Active'}</span></span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
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
