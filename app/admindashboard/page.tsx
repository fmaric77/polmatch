"use client";
import Navigation from '../../components/Navigation';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCSRFToken } from '../../components/hooks/useCSRFToken';

interface User {
  _id?: string;
  user_id: string;
  username: string;
  email: string;
  is_admin: boolean;
  is_banned?: boolean;
  two_factor_enabled?: boolean;
  force_2fa_enabled?: boolean;
}

interface QuestionnaireGroup {
  group_id: string;
  title: string;
  description: string;
  profile_type: string;
  is_hidden: boolean;
  creation_date: string;
  creator_username: string;
  questionnaire_count: number;
}

export default function AdminDashboard() {
  const [form, setForm] = useState({ username: '', email: '', password: '', is_admin: false });
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState<'create' | 'manage' | 'questionnaires'>('create');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [search, setSearch] = useState('');
  const [twoFactorFilter, setTwoFactorFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [questionnaireGroups, setQuestionnaireGroups] = useState<QuestionnaireGroup[]>([]);
  const [loadingQuestionnaires, setLoadingQuestionnaires] = useState(false);
  const [questionnairesError, setQuestionnairesError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const router = useRouter();
  const { protectedFetch } = useCSRFToken();

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
    const res = await protectedFetch('/api/admin/create-user', {
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

  // Filtered users for search and 2FA filter
  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.username.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());
    
    const matches2FA = twoFactorFilter === 'all' || 
      (twoFactorFilter === 'enabled' && user.two_factor_enabled) ||
      (twoFactorFilter === 'disabled' && !user.two_factor_enabled);
    
    return matchesSearch && matches2FA;
  });

  // Fetch questionnaire groups when switching to questionnaires section
  const fetchQuestionnaireGroups = async () => {
    setLoadingQuestionnaires(true);
    setQuestionnairesError('');
    try {
      const res = await protectedFetch('/api/admin/questionnaires');
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
    const res = await protectedFetch('/api/admin/ban-user', {
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

  // Force 2FA handler
  const handleForce2FA = async () => {
    if (!window.confirm('Are you sure you want to force all users without 2FA to enable it? They will be required to set up 2FA on their next login.')) return;
    
    try {
      const res = await protectedFetch('/api/admin/force-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully set force 2FA for ${data.affectedUsers} users without 2FA.`);
        // Refresh the users list
        fetchUsers();
      } else {
        alert(data.message || 'Failed to force 2FA.');
      }
    } catch (error) {
      console.error('Error forcing 2FA:', error);
      alert('Failed to force 2FA.');
    }
  };

  // Force 2FA for individual user
  const handleForceUser2FA = async (user_id: string, username: string) => {
    if (!window.confirm(`Are you sure you want to force ${username} to enable 2FA? They will be required to set up 2FA on their next login.`)) return;
    
    try {
      const res = await protectedFetch('/api/admin/force-user-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully forced 2FA for ${username}.`);
        // Refresh the users list
        fetchUsers();
      } else {
        alert(data.message || 'Failed to force 2FA for user.');
      }
    } catch (error) {
      console.error('Error forcing user 2FA:', error);
      alert('Failed to force 2FA for user.');
    }
  };

  // Filtered questionnaire groups for category filtering
  const filteredQuestionnaireGroups = questionnaireGroups.filter(
    (group) => selectedCategory === 'all' || group.profile_type === selectedCategory
  );

  // Delete questionnaire group handler
  const handleDeleteQuestionnaireGroup = async (groupId: string) => {
    if (!window.confirm('Are you sure you want to delete this questionnaire group? This will delete all questionnaires and questions within it.')) return;
    const res = await protectedFetch(`/api/admin/questionnaires/${groupId}`, {
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
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="admin" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8 w-full max-w-6xl mx-auto mt-4 md:mt-8 p-4 sm:p-6">
          {/* Sidebar for admin navigation - Made responsive */}
          <aside className="w-full md:w-1/4 bg-black/80 border border-white rounded-lg shadow-lg p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 mb-4 md:mb-0">
            <h2 className="text-lg sm:text-xl font-bold mb-2 sm:mb-4 text-white">Admin Menu</h2>
            <nav className="flex flex-row md:flex-col flex-wrap gap-2">
              <button
                className={`text-left p-2 rounded transition-colors font-medium border border-white ${activeSection === 'create' ? 'bg-white/10' : 'hover:bg-white/10'} text-white text-xs sm:text-sm flex-1 md:flex-none`}
                onClick={() => setActiveSection('create')}
              >
                Create User
              </button>
              <button
                className={`text-left p-2 rounded transition-colors font-medium border border-white ${activeSection === 'manage' ? 'bg-white/10' : 'hover:bg-white/10'} text-white text-xs sm:text-sm flex-1 md:flex-none`}
                onClick={() => {
                  setActiveSection('manage');
                  fetchUsers();
                }}
              >
                Manage Users
              </button>
              <button
                className={`text-left p-2 rounded transition-colors font-medium border border-white ${activeSection === 'questionnaires' ? 'bg-white/10' : 'hover:bg-white/10'} text-white text-xs sm:text-sm flex-1 md:flex-none`}
                onClick={() => {
                  setActiveSection('questionnaires');
                  fetchQuestionnaireGroups();
                }}
              >
                Manage Questionnaires
              </button>
              <button className="text-left p-2 rounded hover:bg-white/10 transition-colors font-medium text-white border border-white text-xs sm:text-sm flex-1 md:flex-none">Site Analytics</button>
            </nav>
          </aside>

          {/* Main admin content area */}
          <section className="flex-1 bg-black/80 border border-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 md:mb-8 text-center">Administrator Dashboard</h1>
            {activeSection === 'create' && (
              <div className="bg-black/80 text-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6 md:mb-8">
                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Create New User</h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:gap-4 max-w-md mx-auto">
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={form.username}
                    onChange={handleChange}
                    className="p-2 bg-black text-white border border-white rounded focus:outline-none text-sm sm:text-base"
                    required
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={handleChange}
                    className="p-2 bg-black text-white border border-white rounded focus:outline-none text-sm sm:text-base"
                    required
                  />
                  <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                    className="p-2 bg-black text-white border border-white rounded focus:outline-none text-sm sm:text-base"
                    required
                  />
                  <label className="flex items-center text-white text-sm sm:text-base">
                    <input
                      type="checkbox"
                      name="is_admin"
                      checked={form.is_admin}
                      onChange={handleChange}
                      className="mr-2"
                    />
                    Admin
                  </label>
                  <button type="submit" className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors text-sm sm:text-base">
                    Create User
                  </button>
                  {message && <div className="text-center mt-2 text-green-400 text-sm sm:text-base">{message}</div>}
                </form>
              </div>
            )}
            {activeSection === 'manage' && (
              <div className="bg-black/80 text-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6 md:mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-bold">Manage Users</h2>
                  <button
                    onClick={handleForce2FA}
                    className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-sm font-semibold"
                  >
                    Force 2FA for All Users
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Search by username or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 p-2 bg-black text-white border border-white rounded focus:outline-none text-sm sm:text-base"
                  />
                  <select
                    value={twoFactorFilter}
                    onChange={(e) => setTwoFactorFilter(e.target.value as 'all' | 'enabled' | 'disabled')}
                    className="p-2 bg-black text-white border border-white rounded focus:outline-none text-sm sm:text-base"
                  >
                    <option value="all">All Users</option>
                    <option value="enabled">2FA Enabled</option>
                    <option value="disabled">2FA Disabled</option>
                  </select>
                </div>
                {loadingUsers ? (
                  <div className="text-center py-4 text-sm sm:text-base">Loading users...</div>
                ) : usersError ? (
                  <div className="text-red-400 text-center py-4 text-sm sm:text-base">{usersError}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr>
                          <th className="border-b border-white p-2 text-xs sm:text-sm">Username</th>
                          <th className="border-b border-white p-2 text-xs sm:text-sm">Email</th>
                          <th className="border-b border-white p-2 text-xs sm:text-sm">Admin</th>
                          <th className="border-b border-white p-2 text-xs sm:text-sm">2FA</th>
                          <th className="border-b border-white p-2 text-xs sm:text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => (
                          <tr key={user._id} className="hover:bg-white/10">
                            <td className="p-2 text-xs sm:text-sm">{user.username}</td>
                            <td className="p-2 text-xs sm:text-sm">{user.email}</td>
                            <td className="p-2 text-xs sm:text-sm">{user.is_admin ? 'Yes' : 'No'}</td>
                            <td className="p-2 text-xs sm:text-sm">
                              <span className={`px-2 py-1 rounded text-xs ${
                                user.two_factor_enabled 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-red-600 text-white'
                              }`}>
                                {user.two_factor_enabled ? 'Enabled' : 'Disabled'}
                              </span>
                              {user.force_2fa_enabled && (
                                <span className="ml-1 px-2 py-1 rounded text-xs bg-orange-600 text-white">
                                  Forced
                                </span>
                              )}
                            </td>
                            <td className="p-2">
                              <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                                {!user.two_factor_enabled && !user.force_2fa_enabled && (
                                  <button
                                    className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-xs"
                                    onClick={() => handleForceUser2FA(user.user_id, user.username)}
                                  >
                                    Force 2FA
                                  </button>
                                )}
                                <button
                                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                                  onClick={() => handleBanUser(user.user_id)}
                                >
                                  Ban
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {activeSection === 'questionnaires' && (
              <div className="bg-black/80 text-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6 md:mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-bold">Manage Questionnaires</h2>
                  <button 
                    className="px-3 sm:px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition-colors text-xs sm:text-sm w-full sm:w-auto"
                    onClick={() => window.location.href = '/admindashboard/questionnaires/create'}
                  >
                    Create New Group
                  </button>
                </div>
                
                {/* Category Filter Buttons - Made responsive */}
                <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
                  <button
                    className={`px-2 sm:px-4 py-1 sm:py-2 rounded border transition-colors text-xs sm:text-sm ${
                      selectedCategory === 'all' 
                        ? 'bg-white text-black border-white' 
                        : 'bg-black border-white text-white hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedCategory('all')}
                  >
                    All Categories
                  </button>
                  <button
                    className={`px-2 sm:px-4 py-1 sm:py-2 rounded border transition-colors text-xs sm:text-sm ${
                      selectedCategory === 'basic' 
                        ? 'bg-white text-black border-white' 
                        : 'bg-black border-white text-white hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedCategory('basic')}
                  >
                    Basic
                  </button>
                  <button
                    className={`px-2 sm:px-4 py-1 sm:py-2 rounded border transition-colors text-xs sm:text-sm ${
                      selectedCategory === 'love' 
                        ? 'bg-white text-black border-white' 
                        : 'bg-black border-white text-white hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedCategory('love')}
                  >
                    Love
                  </button>
                  <button
                    className={`px-2 sm:px-4 py-1 sm:py-2 rounded border transition-colors text-xs sm:text-sm ${
                      selectedCategory === 'business' 
                        ? 'bg-white text-black border-white' 
                        : 'bg-black border-white text-white hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedCategory('business')}
                  >
                    Business
                  </button>
                </div>

                {loadingQuestionnaires ? (
                  <div className="text-center py-4 text-sm sm:text-base">Loading questionnaire groups...</div>
                ) : questionnairesError ? (
                  <div className="text-red-400 text-center py-4 text-sm sm:text-base">{questionnairesError}</div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {filteredQuestionnaireGroups.length === 0 ? (
                      <div className="text-center py-6 sm:py-8 text-gray-400 text-sm sm:text-base">
                        {selectedCategory === 'all' 
                          ? 'No questionnaire groups found. Create your first group to get started.'
                          : `No questionnaire groups found for "${selectedCategory}" category.`
                        }
                      </div>
                    ) : (
                      filteredQuestionnaireGroups.map((group) => (
                        <div key={group.group_id} className="border border-white rounded-lg p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-3 sm:gap-0 sm:mb-2">
                            <div>
                              <h3 className="text-base sm:text-lg font-semibold">{group.title}</h3>
                              <p className="text-gray-300 text-xs sm:text-sm">{group.description}</p>
                            </div>
                            <div className="flex gap-2 self-end sm:self-start">
                              <button
                                className="px-2 sm:px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs sm:text-sm"
                                onClick={() => window.location.href = `/admindashboard/questionnaires/${group.group_id}`}
                              >
                                Manage
                              </button>
                              <button
                                className="px-2 sm:px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs sm:text-sm"
                                onClick={() => handleDeleteQuestionnaireGroup(group.group_id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
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
            <div className="bg-black/60 border border-white rounded-lg p-3 sm:p-6 text-white text-center">
              <p className="text-sm sm:text-base md:text-lg">More admin features coming soon...</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
