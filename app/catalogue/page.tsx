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
        setActionMessage('Subject removed from files');
        fetchCatalogueItems(); // Refresh the list
      } else {
        setActionMessage(data.error || 'Failed to remove subject from files');
      }
    } catch (error) {
      console.error('Failed to remove from catalogue:', error);
      setActionMessage('Failed to remove subject from files');
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
    love: 'PERSONAL',
    basic: 'GENERAL',
    business: 'CORPORATE'
  };

  const categoryColors = {
    love: 'bg-red-900 hover:bg-red-800 border-red-700',
    basic: 'bg-gray-900 hover:bg-gray-800 border-gray-700',
    business: 'bg-green-900 hover:bg-green-800 border-green-700'
  };

  const getCaseNumber = (category: string): string => {
    const prefix = category === 'love' ? 'PER' : category === 'business' ? 'COR' : 'GEN';
    return `${prefix}-${new Date().getFullYear()}`;
  };

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="catalogue" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto mt-4 md:mt-8 p-4 md:p-6 pb-8">
          {/* FBI-Style Header */}
          <div className="bg-black border-2 border-white rounded-none shadow-2xl mb-6">
            <div className="border-b-2 border-white bg-white text-black p-4 text-center">
              <div className="font-mono text-xs mb-1">CLASSIFIED</div>
              <h1 className="text-2xl font-bold tracking-widest">SUBJECT FILES REPOSITORY</h1>
              <div className="font-mono text-xs mt-1">CONFIDENTIAL - AUTHORIZED ACCESS ONLY</div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 text-center text-xs font-mono mb-4">
                <div>
                  <div className="text-gray-400">TOTAL SUBJECTS</div>
                  <div className="text-xl font-bold">{catalogueItems.length.toString().padStart(3, '0')}</div>
                </div>
                <div>
                  <div className="text-gray-400">ACTIVE CASES</div>
                  <div className="text-xl font-bold">{getCaseNumber(selectedCategory)}</div>
                </div>
                <div>
                  <div className="text-gray-400">CLEARANCE LEVEL</div>
                  <div className="text-xl font-bold text-red-400">TOP SECRET</div>
                </div>
              </div>
              
              {/* Case Type Selection */}
              <div className="flex justify-center gap-2 mb-4">
                <div className="text-sm font-mono text-gray-400 mr-4 self-center">CASE TYPE:</div>
                {(Object.keys(categoryLabels) as CatalogueCategory[]).map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 border-2 font-mono text-sm tracking-wider transition-all ${
                      selectedCategory === category 
                        ? `${categoryColors[category]} text-white`
                        : 'border-gray-600 bg-black text-gray-400 hover:border-gray-400 hover:text-white'
                    }`}
                  >
                    {categoryLabels[category]} ({catalogueItems.filter(item => item.category === category).length.toString().padStart(2, '0')})
                  </button>
                ))}
              </div>

              {actionMessage && (
                <div className="mb-4 text-center text-red-400 text-sm font-mono border border-red-400 bg-red-900/20 p-2">
                  ⚠ {actionMessage.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Files Container */}
          <div className="bg-black border-2 border-white rounded-none shadow-2xl">
            {loading ? (
              <div className="text-center py-12">
                <div className="font-mono text-gray-400 mb-2">ACCESSING CLASSIFIED FILES...</div>
                <div className="text-red-400 animate-pulse">● ● ●</div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <div className="font-mono text-gray-400 mb-4">
                  NO {categoryLabels[selectedCategory]} FILES ON RECORD
                </div>
                <div className="text-sm text-gray-500 font-mono">
                  VISIT <a href="/search" className="text-blue-400 hover:text-blue-300 underline">SUBJECT SEARCH</a> TO ADD NEW FILES
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="grid gap-4">
                  {filteredItems.map((item, index) => (
                    <div key={item.user_id} className="border border-gray-600 bg-gray-900/50 relative">
                      {/* File Header */}
                      <div className="bg-white text-black p-2 font-mono text-xs flex justify-between">
                        <div>
                          <span className="font-bold">FILE #{index + 1}.{getCaseNumber(selectedCategory)}</span>
                          <span className="ml-4">CLASSIFICATION: {categoryLabels[selectedCategory]}</span>
                        </div>
                        <div>
                          ARCHIVED: {new Date(item.added_at).toLocaleDateString('en-US').replace(/\//g, '.')}
                        </div>
                      </div>
                      
                      {/* File Content */}
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          {/* Subject Info */}
                          <div className="flex items-start space-x-4 flex-1">
                            {/* Photo Section */}
                            <div className="border-2 border-white bg-gray-800 p-2">
                              <div className="text-xs font-mono text-gray-400 mb-1 text-center">PHOTO</div>
                              <ProfileAvatar userId={item.user_id} size={64} className="border border-gray-600" />
                              <div className="text-xs font-mono text-gray-400 mt-1 text-center">ID: {item.user_id.substring(0, 8).toUpperCase()}</div>
                            </div>
                            
                            {/* Subject Details */}
                            <div className="flex-1 font-mono">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                <div>
                                  <span className="text-gray-400">SUBJECT NAME:</span>
                                  <div className="text-white font-bold tracking-wider">
                                    {(item.display_name || item.username || 'UNKNOWN').toUpperCase()}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-400">USERNAME:</span>
                                  <div className="text-white">@{item.username || 'CLASSIFIED'}</div>
                                </div>
                                <div>
                                  <span className="text-gray-400">FILE OPENED:</span>
                                  <div className="text-white">{new Date(item.added_at).toLocaleDateString('en-US')}</div>
                                </div>
                                <div>
                                  <span className="text-gray-400">STATUS:</span>
                                  <div className="text-green-400 font-bold">ACTIVE</div>
                                </div>
                              </div>
                              
                              {/* Redacted Information Bar */}
                              <div className="mt-3 p-2 bg-black border border-gray-600">
                                <div className="text-xs text-gray-500 font-mono">
                                  ADDITIONAL INFORMATION: <span className="bg-black text-black border-b border-gray-600">█████████████████████</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex flex-col space-y-2 ml-4">
                            <button 
                              onClick={() => handleViewProfile(item)} 
                              className="px-4 py-2 bg-white text-black font-mono text-xs border-2 border-black hover:bg-gray-200 transition-colors tracking-wider"
                            >
                              VIEW DOSSIER
                            </button>
                            <button 
                              onClick={() => removeFromCatalogue(item.user_id)} 
                              className="px-4 py-2 bg-red-900 text-white font-mono text-xs border-2 border-red-700 hover:bg-red-800 transition-colors tracking-wider"
                            >
                              ARCHIVE FILE
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Security Footer */}
                      <div className="bg-red-900 text-white p-1 text-xs font-mono text-center border-t border-red-700">
                        ⚠ CONFIDENTIAL - UNAUTHORIZED ACCESS PROHIBITED ⚠
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
            username={selectedUser.display_name || `AGENT-${selectedUser.user_id.substring(0, 8).toUpperCase()}`}
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
