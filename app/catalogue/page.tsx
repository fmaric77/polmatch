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
        setActionMessage('Profile removed from collection');
        fetchCatalogueItems(); // Refresh the list
      } else {
        setActionMessage(data.error || 'Failed to remove profile');
      }
    } catch (error) {
      console.error('Failed to remove from catalogue:', error);
      setActionMessage('Failed to remove profile');
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
    love: 'Dating',
    basic: 'General',
    business: 'Business'
  };

  const categoryColors = {
    love: 'bg-red-900 hover:bg-red-800 border-red-700',
    basic: 'bg-gray-900 hover:bg-gray-800 border-gray-700',
    business: 'bg-green-900 hover:bg-green-800 border-green-700'
  };

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="catalogue" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto mt-4 md:mt-8 p-4 md:p-6 pb-8">
          <div className="bg-black border-2 border-white rounded-none shadow-2xl mb-6">
            <div className="p-3 sm:p-6">
              {/* Category Selection */}
              <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mb-4">
                <div className="text-sm font-mono text-gray-400 mb-2 sm:mb-0 sm:mr-4 self-center">Category:</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {(Object.keys(categoryLabels) as CatalogueCategory[]).map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 sm:px-4 py-2 border-2 font-mono text-xs sm:text-sm tracking-wider transition-all ${
                        selectedCategory === category 
                          ? `${categoryColors[category]} text-white`
                          : 'border-gray-600 bg-black text-gray-400 hover:border-gray-400 hover:text-white'
                      }`}
                    >
                      {categoryLabels[category]} ({catalogueItems.filter(item => item.category === category).length})
                    </button>
                  ))}
                </div>
              </div>

              {actionMessage && (
                <div className="mb-4 text-center text-red-400 text-sm font-mono border border-red-400 bg-red-900/20 p-2">
                  {actionMessage}
                </div>
              )}
            </div>
          </div>

          {/* Files Container */}
          <div className="bg-black border-2 border-white rounded-none shadow-2xl">
            {loading ? (            <div className="text-center py-12">
              <div className="font-mono text-gray-400 mb-2">Loading...</div>
              <div className="text-red-400 animate-pulse">● ● ●</div>
            </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <div className="font-mono text-gray-400 mb-4">
                  No {categoryLabels[selectedCategory]} profiles saved
                </div>
                <div className="text-sm text-gray-500 font-mono">
                  Visit <a href="/search" className="text-blue-400 hover:text-blue-300 underline">Search</a> to add profiles
                </div>
              </div>
            ) : (
              <div className="p-3 sm:p-6">
                <div className="grid gap-4">
                  {filteredItems.map((item) => (
                    <div key={item.user_id} className="border border-gray-600 bg-gray-900/50 relative">
                      {/* File Header */}
                      <div className="bg-white text-black p-2 font-mono text-xs flex flex-col sm:flex-row sm:justify-between">
                        <div>
                          <span className="font-bold">{categoryLabels[selectedCategory]} Profile</span>
                        </div>
                        <div className="mt-1 sm:mt-0">
                          Added: {new Date(item.added_at).toLocaleDateString('en-US')}
                        </div>
                      </div>
                      
                      {/* File Content - Made responsive */}
                      <div className="p-3 sm:p-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between">
                          {/* Subject Info */}
                          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
                            {/* Photo Section */}
                            <div className="border-2 border-white bg-gray-800 p-2">
                              <div className="text-xs font-mono text-gray-400 mb-1 text-center">Photo</div>
                              <ProfileAvatar userId={item.user_id} size={64} className="border border-gray-600" />
                            </div>
                            
                            {/* Details */}
                            <div className="flex-1 font-mono w-full">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                <div>
                                  <span className="text-gray-400">Name:</span>
                                  <div className="text-white font-bold tracking-wider">
                                    {item.display_name ? item.display_name.toUpperCase() : `${item.category} User`}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-400">Category:</span>
                                  <div className="text-white">{categoryLabels[item.category]}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex sm:flex-col justify-center mt-4 md:mt-0 space-x-2 sm:space-x-0 sm:space-y-2 sm:ml-4">
                            <button 
                              onClick={() => handleViewProfile(item)} 
                              className="px-3 sm:px-4 py-2 bg-white text-black font-mono text-xs border-2 border-black hover:bg-gray-200 transition-colors tracking-wider flex-1 sm:flex-none"
                            >
                              View Profile
                            </button>
                            <button 
                              onClick={() => removeFromCatalogue(item.user_id)} 
                              className="px-3 sm:px-4 py-2 bg-red-900 text-white font-mono text-xs border-2 border-red-700 hover:bg-red-800 transition-colors tracking-wider flex-1 sm:flex-none"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Profile Modal */}
        {selectedUser && (
          <ProfileModal
            userId={selectedUser.user_id}
            username={selectedUser.display_name ? selectedUser.display_name.toUpperCase() : `${selectedCategory} User`}
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
