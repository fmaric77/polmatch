"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import ProfileAvatar from '../../components/ProfileAvatar';
import ProfileModal from '../../components/ProfileModal';
import { useCSRFToken } from '../../components/hooks/useCSRFToken';

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
  ai_excluded?: boolean;
}

interface AIAnalysis {
  analysis: string;
  current_user: {
    name: string;
    answers_count: number;
  };
  other_user: {
    name: string;
    answers_count: number;
  };
  profile_type: string;
}

type CatalogueCategory = 'love' | 'basic' | 'business';

export default function CataloguePage() {
  const { protectedFetch } = useCSRFToken();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CatalogueCategory>('basic');
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  // AI Analysis state
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

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

  async function removeFromCatalogue(userId: string, category: string) {
    setActionMessage('');
    try {
      const res = await protectedFetch('/api/catalogue/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, category: category })
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

  async function handleAIComparison(item: CatalogueItem) {
    setAiLoading(true);
    setAiError('');
    setAiAnalysis(null);
    
    try {
      const res = await protectedFetch('/api/ai/profile-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          other_user_id: item.user_id,
          profile_type: item.category
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setAiAnalysis(data);
        setShowAIModal(true);
      } else {
        setAiError(data.message || 'Failed to generate AI analysis');
      }
    } catch (error) {
      console.error('AI comparison error:', error);
      setAiError('Failed to connect to AI service');
    } finally {
      setAiLoading(false);
    }
  }

  function closeAIModal() {
    setShowAIModal(false);
    setAiAnalysis(null);
    setAiError('');
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

              {aiError && (
                <div className="mb-4 text-center text-red-400 text-sm font-mono border border-red-400 bg-red-900/20 p-2">
                  AI Error: {aiError}
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
                    <div key={`${item.user_id}-${item.category}`} className="border border-gray-600 bg-gray-900/50 relative">
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
                              onClick={() => handleAIComparison(item)}
                              disabled={aiLoading || item.ai_excluded}
                              className={`px-3 sm:px-4 py-2 font-mono text-xs border-2 transition-colors tracking-wider flex-1 sm:flex-none ${
                                item.ai_excluded 
                                  ? 'bg-gray-700 text-gray-500 border-gray-600 cursor-not-allowed' 
                                  : 'bg-blue-900 text-white border-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                              title={item.ai_excluded ? 'User has opted out of AI analysis' : ''}
                            >
                              {item.ai_excluded ? 'AI DISABLED' : (aiLoading ? 'ANALYZING...' : 'AI SUMMARY')}
                            </button>
                            <button 
                              onClick={() => removeFromCatalogue(item.user_id, item.category)} 
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

        {/* AI Analysis Modal */}
        {showAIModal && aiAnalysis && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-black border-2 border-white rounded-none shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="border-b-2 border-white bg-white text-black p-3 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold tracking-wider">🤖 AI COMPATIBILITY ANALYSIS</h2>
                  <div className="font-mono text-xs mt-1">
                    {aiAnalysis.current_user.name} vs {aiAnalysis.other_user.name} ({aiAnalysis.profile_type.toUpperCase()})
                  </div>
                </div>
                <button
                  onClick={closeAIModal}
                  className="px-3 py-1 bg-red-600 text-white font-mono text-xs border border-red-400 hover:bg-red-700 transition-colors"
                >
                  ✕ CLOSE
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                <div className="space-y-4">
                  {/* AI Analysis Content */}
                  <div className="bg-gray-900/30 border border-gray-600 p-4">
                    <div className="text-xs font-mono text-gray-400 mb-3 flex items-center">
                      <span className="animate-pulse mr-2">🧠</span>
                      GROK AI ANALYSIS
                    </div>
                    <div className="text-sm text-white leading-relaxed">
                      {aiAnalysis.analysis.split('\n').map((line, index) => {
                        // Handle markdown headers
                        if (line.startsWith('## ')) {
                          return (
                            <h3 key={index} className="text-lg font-bold text-blue-400 mt-6 mb-3 first:mt-0">
                              {line.replace('## ', '')}
                            </h3>
                          );
                        }
                        // Handle markdown lists
                        if (line.startsWith('- ')) {
                          return (
                            <div key={index} className="ml-4 mb-2 flex items-start">
                              <span className="text-blue-400 mr-2">•</span>
                              <span>{line.replace('- ', '')}</span>
                            </div>
                          );
                        }
                        // Handle numbered lists
                        if (/^\d+\./.test(line)) {
                          return (
                            <div key={index} className="ml-4 mb-2 flex items-start">
                              <span className="text-blue-400 mr-2">{line.match(/^\d+/)?.[0]}.</span>
                              <span>{line.replace(/^\d+\.\s*/, '')}</span>
                            </div>
                          );
                        }
                        // Handle bold text
                        if (line.includes('**')) {
                          const parts = line.split('**');
                          return (
                            <p key={index} className="mb-3">
                              {parts.map((part, partIndex) => 
                                partIndex % 2 === 1 ? 
                                  <strong key={partIndex} className="font-bold text-white">{part}</strong> : 
                                  <span key={partIndex}>{part}</span>
                              )}
                            </p>
                          );
                        }
                        // Handle regular paragraphs
                        if (line.trim()) {
                          return (
                            <p key={index} className="mb-3 text-gray-200">
                              {line}
                            </p>
                          );
                        }
                        // Handle empty lines
                        return <div key={index} className="mb-2"></div>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
