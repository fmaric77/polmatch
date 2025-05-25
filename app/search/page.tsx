"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import ProfileAvatar from '../../components/ProfileAvatar';
import ProfileModal from '../../components/ProfileModal';

interface User {
  user_id: string;
  username: string;
  display_name?: string;
}

export default function SearchUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<User[]>([]);
  const [actionMessage, setActionMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Fetch current user ID and validate session
  useEffect(() => {
    async function fetchSession() {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.valid) {
        router.replace('/login');
        return;
      }
      setCurrentUserId(data.user.user_id);
    }
    fetchSession();
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setFiltered(
      users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.display_name || '').toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, users]);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users/list');
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch {}
  }

  async function sendFriendRequest(friend_id: string) {
    setActionMessage('');
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id })
      });
      const data = await res.json();
      setActionMessage(data.message);
    } catch {
      setActionMessage('Failed to send request');
    }
  }

  async function handleDirectMessage(user: User) {
    setActionMessage('Starting conversation...');
    try {
      // Create conversation in database first
      const res = await fetch('/api/private-conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          other_user_id: user.user_id
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setActionMessage('Conversation created! Redirecting...');
        // Small delay to ensure database consistency before navigation
        setTimeout(() => {
          window.location.href = `/chat?user=${user.user_id}`;
        }, 500);
      } else {
        setActionMessage('Failed to start conversation: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      setActionMessage('Failed to start conversation. Please try again.');
    }
  }

  function handleInviteToGroup(user: User) {
    // Implement group invite logic or modal
    alert(`Invite to group: ${user.display_name || user.username}`);
  }

  function handleViewProfile(user: User) {
    setSelectedUser(user);
    setIsProfileModalOpen(true);
  }

  function closeProfileModal() {
    setIsProfileModalOpen(false);
    setSelectedUser(null);
  }

  // Exclude current user from results
  const availableUsers = filtered.filter(u => u.user_id !== currentUserId);

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="search" />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="w-full max-w-3xl mx-auto mt-12 p-8">
          <div className="bg-black/80 border border-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Search Users</h2>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by username or display name..."
              className="w-full p-3 mb-6 bg-black text-white border border-white rounded focus:outline-none"
            />
            {actionMessage && <div className="mb-4 text-center text-green-400">{actionMessage}</div>}
            <ul className="space-y-4">
              {availableUsers.map(user => (
                <li key={user.user_id} className="flex justify-between items-center border-b border-gray-700 pb-2">
                  <div className="flex items-center space-x-3">
                    <ProfileAvatar userId={user.user_id} size={40} />
                    <span>{user.display_name || user.username || user.user_id}</span>
                  </div>
                  <span className="flex gap-2">
                    <button onClick={() => handleViewProfile(user)} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">Profiles</button>
                    <button onClick={() => sendFriendRequest(user.user_id)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Add Friend</button>
                    <button onClick={() => handleDirectMessage(user)} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Message</button>
                    <button onClick={() => handleInviteToGroup(user)} className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">Invite to Group</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Profile Modal */}
        {selectedUser && (
          <ProfileModal
            userId={selectedUser.user_id}
            username={selectedUser.display_name || selectedUser.username}
            isOpen={isProfileModalOpen}
            onClose={closeProfileModal}
          />
        )}
      </main>
    </div>
  );
}
