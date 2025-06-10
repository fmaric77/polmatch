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

interface CatalogueItem {
  user_id: string;
  username: string;
  display_name?: string;
  category: 'love' | 'basic' | 'business';
  added_at: string;
}

type CatalogueCategory = 'love' | 'basic' | 'business';

export default function CataloguePage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CatalogueCategory>('basic');
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  // Fetch current user ID and validate session
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (!data.valid) {
          router.replace('/login');
          return;
        }
        setCurrentUserId(data.user.user_id);
      } catch (error) {
        console.error('Failed to fetch session:', error);
        router.replace('/login');
      }
    }
    fetchSession();
  }, [router]);

  // Fetch catalogue items when user ID is available
  useEffect(() => {
    if (currentUserId) {
      fetchCatalogueItems();
    }
  }, [currentUserId]);

  async function fetchCatalogueItems() {
    setLoading(true);
    try {
      const res = await fetch('/api/catalogue');
      const data = await res.json();
      if (data.success) {
        setCatalogueItems(data.items || []);
      } else {
        setActionMessage('Failed to load catalogue items');
      }
    } catch (error) {
      console.error('Failed to fetch catalogue items:', error);
      setActionMessage('Failed to load catalogue items');
    } finally {
      setLoading(false);
    }
  }

  async function removeFromCatalogue(userId: string) {
    setActionMessage('');
    try {
      const res = await fetch('/api/catalogue/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage('User removed from catalogue');
        fetchCatalogueItems(); // Refresh the list
      } else {
        setActionMessage(data.error || 'Failed to remove user from catalogue');
      }
    } catch (error) {
      console.error('Failed to remove from catalogue:', error);
      setActionMessage('Failed to remove user from catalogue');
    }
  }

  function handleViewProfile(user: CatalogueItem): void {
    setSelectedUser({
      user_id: user.user_id,
      username: user.username,
      display_name: user.display_name
    });
    setIsProfileModalOpen(true);
  }

  function closeProfileModal() {
    setIsProfileModalOpen(false);
    setSelectedUser(null);
  }

  // Filter items by selected category
  const filteredItems = catalogueItems.filter(item => item.category === selectedCategory);

  const categoryLabels = {
    love: 'Love',
    basic: 'Basic',
    business: 'Business'
  };

  const categoryColors = {
    love: 'bg-pink-600 hover:bg-pink-700',
    basic: 'bg-blue-600 hover:bg-blue-700',
    business: 'bg-green-600 hover:bg-green-700'
  };

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="catalogue" />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="w-full max-w-4xl mx-auto mt-4 md:mt-12 p-4 md:p-8">
          <div className="bg-black/80 border border-white rounded-lg shadow-lg p-4 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">My Catalogue</h2>
            
            {/* Category Selection Buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(Object.keys(categoryLabels) as CatalogueCategory[]).map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded transition-colors text-white font-medium ${
                    selectedCategory === category 
                      ? categoryColors[category]
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {categoryLabels[category]} ({catalogueItems.filter(item => item.category === category).length})
                </button>
              ))}
            </div>

            {actionMessage && (
              <div className="mb-4 text-center text-green-400 text-sm md:text-base px-2">
                {actionMessage}
              </div>
            )}

            {/* Catalogue Items */}
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-400">Loading catalogue...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-2">
                  No users in your {categoryLabels[selectedCategory].toLowerCase()} catalogue yet.
                </p>
                <p className="text-sm text-gray-500">
                  Visit the <a href="/search" className="text-blue-400 hover:text-blue-300">search page</a> to add users to your catalogue.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItems.map(item => (
                  <div key={item.user_id} className="border-b border-gray-700 pb-4 last:border-b-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      {/* User Info */}
                      <div className="flex items-center space-x-3 min-w-0 flex-shrink">
                        <ProfileAvatar userId={item.user_id} size={40} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm md:text-base truncate font-medium">
                            {item.display_name || item.username || item.user_id}
                          </span>
                          <span className="text-xs text-gray-400">
                            Added on {new Date(item.added_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-2">
                        <button 
                          onClick={() => handleViewProfile(item)} 
                          className="flex-1 sm:flex-none px-3 py-2 bg-indigo-600 text-white rounded text-xs md:text-sm hover:bg-indigo-700 transition-colors whitespace-nowrap"
                        >
                          View Profile
                        </button>
                        <button 
                          onClick={() => removeFromCatalogue(item.user_id)} 
                          className="flex-1 sm:flex-none px-3 py-2 bg-red-600 text-white rounded text-xs md:text-sm hover:bg-red-700 transition-colors whitespace-nowrap"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Profile Modal */}
        {selectedUser && (
          <ProfileModal
            userId={selectedUser.user_id}
            username={selectedUser.display_name || selectedUser.username}
            isOpen={isProfileModalOpen}
            onClose={closeProfileModal}
            defaultActiveTab={selectedCategory}
            restrictToProfileType={true}
          />
        )}
      </main>
    </div>
  );
}
