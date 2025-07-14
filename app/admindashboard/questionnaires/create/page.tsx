"use client";
import Navigation from '../../../../components/Navigation';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCSRFToken } from '../../../../components/hooks/useCSRFToken';

export default function CreateQuestionnaireGroup() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    profile_type: 'basic',
    is_hidden: false,
    required_for: []
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { protectedFetch } = useCSRFToken();

  useEffect(() => {
    // Check if user is admin
    async function checkAdmin() {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.valid || !data.user?.is_admin) {
        router.replace('/');
      }
    }
    checkAdmin();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = 'checked' in e.target ? e.target.checked : false;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const res = await protectedFetch('/api/admin/questionnaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage('Questionnaire group created successfully!');
        setTimeout(() => {
          router.push(`/admindashboard/questionnaires/${data.group_id}`);
        }, 1500);
      } else {
        setMessage(data.message || 'Failed to create questionnaire group');
      }
    } catch {
      setMessage('Failed to create questionnaire group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="admin" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto mt-4 md:mt-8 p-4 sm:p-6">
          <div className="bg-black/80 border border-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
              <button
                onClick={() => router.back()}
                className="mr-0 sm:mr-4 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm sm:text-base w-fit"
              >
                ← Back
              </button>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Create Questionnaire Group</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="w-full p-2 sm:p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400 text-sm sm:text-base"
                  required
                  placeholder="Enter questionnaire group title"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2">Description *</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full p-2 sm:p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400 text-sm sm:text-base"
                  required
                  placeholder="Enter description for this questionnaire group"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2">Profile Type *</label>
                <select
                  name="profile_type"
                  value={form.profile_type}
                  onChange={handleChange}
                  className="w-full p-2 sm:p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400 text-sm sm:text-base"
                  required
                >
                  <option value="basic">Basic Profile</option>
                  <option value="business">Business Profile</option>
                  <option value="love">Love Profile</option>
                </select>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  Choose which type of profile this questionnaire group will be available for
                </p>
              </div>

              <div>
                <label className="flex items-center text-sm sm:text-base">
                  <input
                    type="checkbox"
                    name="is_hidden"
                    checked={form.is_hidden}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span>Hidden (not visible to users)</span>
                </label>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  Hidden groups are not shown to users but can be used for admin purposes
                </p>
              </div>

              <div className="flex flex-col xs:flex-row gap-3 xs:gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>

              {message && (
                <div className={`text-center mt-4 text-sm sm:text-base ${message.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                  {message}
                </div>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
