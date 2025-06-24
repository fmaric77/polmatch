import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUsers, faLock } from '@fortawesome/free-solid-svg-icons';
import { useCSRFToken } from '../hooks/useCSRFToken';

interface CreateGroupModalProps {
  onClose: () => void;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  onSuccess: () => void;
  activeProfileType?: 'basic' | 'love' | 'business';
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  onClose,
  currentUser,
  onSuccess,
  activeProfileType = 'basic'
}) => {
  const { protectedFetch } = useCSRFToken();
  const [form, setForm] = useState({
    name: '',
    description: '',
    topic: '',
    is_private: false,
    profile_type: activeProfileType
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper function to get profile label
  const getProfileLabel = (profileType: 'basic' | 'love' | 'business'): string => {
    switch (profileType) {
      case 'love':
        return 'Dating';
      case 'business':
        return 'Business';
      default:
        return 'General';
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError('Group name is required');
      return;
    }

    if (form.name.length < 3) {
      setError('Group name must be at least 3 characters');
      return;
    }

    if (form.name.length > 50) {
      setError('Group name must be less than 50 characters');
      return;
    }

    if (!form.description.trim()) {
      setError('Group description is required');
      return;
    }

    if (form.description.length > 200) {
      setError('Description must be less than 200 characters');
      return;
    }

    if (form.topic.length > 100) {
      setError('Topic must be less than 100 characters');
      return;
    }

    if (!currentUser) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await protectedFetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          topic: form.topic.trim(),
          is_private: form.is_private,
          profile_type: form.profile_type
        })
      });

      const data = await res.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to create group');
      }
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof form, value: string | boolean): void => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 font-mono">
      <div className="bg-black border-2 border-white rounded-none p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-red-500 font-mono uppercase tracking-widest text-xs mb-2">CREATE GROUP</div>
            <h2 className="text-xl font-mono uppercase tracking-wider text-white flex items-center">
              <FontAwesomeIcon icon={faUsers} className="mr-3" />
              CREATE GROUP
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-black text-red-400 border border-red-400 rounded-none hover:bg-red-400 hover:text-black transition-all shadow-lg font-mono"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-mono uppercase tracking-wide mb-3">
              GROUP NAME
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="ENTER GROUP NAME"
              className="w-full bg-black text-white border-2 border-white rounded-none p-3 focus:outline-none focus:border-blue-400 font-mono shadow-lg"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm font-mono uppercase tracking-wide mb-3">
              DESCRIPTION
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="ENTER GROUP DESCRIPTION"
              className="w-full bg-black text-white border-2 border-white rounded-none p-3 focus:outline-none focus:border-blue-400 resize-none font-mono shadow-lg"
              rows={3}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm font-mono uppercase tracking-wide mb-3">
              PROFILE TYPE
            </label>
            <select
              value={form.profile_type}
              onChange={(e) => handleInputChange('profile_type', e.target.value as 'basic' | 'love' | 'business')}
              className="w-full bg-black text-white border-2 border-white rounded-none p-3 focus:outline-none focus:border-blue-400 font-mono shadow-lg"
              disabled={loading}
            >
              {(['basic', 'love', 'business'] as const).map((type) => (
                <option key={type} value={type} className="bg-black text-white">
                  {getProfileLabel(type).toUpperCase()}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-400 mt-2 font-mono">
              Groups are separated by profile type. Only users with the selected profile can join.
            </div>
          </div>

          <div>
            <label className="block text-white text-sm font-mono uppercase tracking-wide mb-3">
              TOPIC (OPTIONAL)
            </label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => handleInputChange('topic', e.target.value)}
              placeholder="ENTER GROUP TOPIC"
              className="w-full bg-black text-white border-2 border-white rounded-none p-3 focus:outline-none focus:border-blue-400 font-mono shadow-lg"
              disabled={loading}
            />
          </div>

          <div className="flex items-center space-x-3 p-3 bg-black border-2 border-gray-400 rounded-none shadow-lg">
            <input
              type="checkbox"
              id="is_private"
              checked={form.is_private}
              onChange={(e) => handleInputChange('is_private', e.target.checked)}
              className="text-white focus:ring-white"
              disabled={loading}
            />
            <label htmlFor="is_private" className="text-white text-sm flex items-center font-mono uppercase tracking-wide">
              <FontAwesomeIcon icon={faLock} className="mr-2 text-red-400" />
              PRIVATE GROUP
            </label>
          </div>

          {error && (
            <div className="bg-red-600/20 border-2 border-red-400 rounded-none p-3">
              <div className="text-red-400 text-sm font-mono uppercase tracking-wide">{error}</div>
            </div>
          )}

          <div className="flex space-x-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-black text-gray-400 border-2 border-gray-400 py-3 px-4 rounded-none hover:bg-gray-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wide"
              disabled={loading}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex-1 bg-black text-green-400 border-2 border-green-400 py-3 px-4 rounded-none hover:bg-green-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wide disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed"
              disabled={loading || !form.name.trim() || !form.description.trim()}
            >
              {loading ? 'CREATING...' : 'CREATE GROUP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;