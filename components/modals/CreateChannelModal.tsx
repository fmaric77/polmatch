import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faHashtag } from '@fortawesome/free-solid-svg-icons';

interface CreateChannelModalProps {
  selectedConversation: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  selectedConversation,
  onClose,
  onSuccess
}) => {
  const [form, setForm] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError('Channel name is required');
      return;
    }

    if (form.name.length < 3) {
      setError('Channel name must be at least 3 characters');
      return;
    }

    if (form.name.length > 50) {
      setError('Channel name must be less than 50 characters');
      return;
    }

    // Channel name validation (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(form.name)) {
      setError('Channel name can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    if (form.description && form.description.length > 200) {
      setError('Description must be less than 200 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/groups/${selectedConversation}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim()
        })
      });

      const data = await res.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to create channel');
      }
    } catch (err) {
      console.error('Error creating channel:', err);
      setError('Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof form, value: string): void => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <FontAwesomeIcon icon={faHashtag} className="mr-2" />
            Create Channel
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
              Channel Name
            </label>
            <div className="relative">
              <FontAwesomeIcon 
                icon={faHashtag} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
              />
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleInputChange('name', e.target.value.toLowerCase())}
                placeholder="channel-name"
                className="w-full bg-black text-white border border-white rounded p-2 pl-10 focus:outline-none focus:ring-1 focus:ring-white"
                disabled={loading}
                required
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Use lowercase letters, numbers, hyphens, and underscores only
            </div>
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Description (Optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="What's this channel about?"
              className="w-full bg-black text-white border border-white rounded p-2 focus:outline-none focus:ring-1 focus:ring-white resize-none"
              rows={3}
              disabled={loading}
            />
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
              disabled={loading || !form.name.trim()}
            >
              {loading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;