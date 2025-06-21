import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faHashtag } from '@fortawesome/free-solid-svg-icons';

interface CreateChannelModalProps {
  selectedConversation: string;
  onClose: () => void;
  onSuccess: () => void;
  profileType?: string;
}

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  selectedConversation,
  onClose,
  onSuccess,
  profileType
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
          description: form.description.trim(),
          ...(profileType && { profile_type: profileType })
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
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 font-mono">
      <div className="bg-black border-2 border-white rounded-none p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-mono uppercase tracking-wider text-white flex items-center">
              <FontAwesomeIcon icon={faHashtag} className="mr-3" />
              Create Channel
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
              CHANNEL DESIGNATION
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
                placeholder="channel-designation"
                className="w-full bg-black text-white border-2 border-white rounded-none p-3 pl-10 focus:outline-none focus:border-blue-400 font-mono shadow-lg"
                disabled={loading}
                required
              />
            </div>
            <div className="text-xs text-gray-400 mt-2 font-mono uppercase tracking-wide">
              USE LOWERCASE LETTERS, NUMBERS, HYPHENS, AND UNDERSCORES ONLY
            </div>
          </div>

          <div>
            <label className="block text-white text-sm font-mono uppercase tracking-wide mb-3">
              DESCRIPTION (OPTIONAL)
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Channel purpose..."
              className="w-full bg-black text-white border-2 border-white rounded-none p-3 focus:outline-none focus:border-blue-400 resize-none font-mono shadow-lg"
              rows={3}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-600/20 border-2 border-red-400 rounded-none p-3">
              <div className="text-red-400 text-sm font-mono uppercase tracking-wide">{error}</div>
            </div>
          )}

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-black text-gray-400 border-2 border-gray-400 py-3 px-4 rounded-none hover:bg-gray-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wide"
              disabled={loading}
            >
              ABORT
            </button>
            <button
              type="submit"
              className="flex-1 bg-black text-green-400 border-2 border-green-400 py-3 px-4 rounded-none hover:bg-green-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wide disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed"
              disabled={loading || !form.name.trim()}
            >
              {loading ? 'ESTABLISHING...' : 'CREATE CHANNEL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;