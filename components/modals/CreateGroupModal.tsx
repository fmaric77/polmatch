import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUsers, faLock } from '@fortawesome/free-solid-svg-icons';

interface CreateGroupModalProps {
  onClose: () => void;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  onSuccess: () => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  onClose,
  currentUser,
  onSuccess
}) => {
  const [form, setForm] = useState({
    name: '',
    description: '',
    topic: '',
    is_private: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const res = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          topic: form.topic.trim(),
          is_private: form.is_private
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <FontAwesomeIcon icon={faUsers} className="mr-2" />
            Create Group
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter group name"
              className="w-full bg-black text-white border border-white rounded p-2 focus:outline-none focus:ring-1 focus:ring-white"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter group description"
              className="w-full bg-black text-white border border-white rounded p-2 focus:outline-none focus:ring-1 focus:ring-white resize-none"
              rows={3}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Topic (Optional)
            </label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => handleInputChange('topic', e.target.value)}
              placeholder="Enter group topic"
              className="w-full bg-black text-white border border-white rounded p-2 focus:outline-none focus:ring-1 focus:ring-white"
              disabled={loading}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_private"
              checked={form.is_private}
              onChange={(e) => handleInputChange('is_private', e.target.checked)}
              className="text-white focus:ring-white"
              disabled={loading}
            />
            <label htmlFor="is_private" className="text-white text-sm flex items-center">
              <FontAwesomeIcon icon={faLock} className="mr-1" />
              Private Group
            </label>
          </div>

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-white text-black py-2 px-4 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              disabled={loading || !form.name.trim() || !form.description.trim()}
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;