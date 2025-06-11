"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, 
  faUsers, 
  faPlus, 
  faCalendar,
  faClock,
  faArrowLeft,
  faArrowRight
} from '@fortawesome/free-solid-svg-icons';

interface PublicGroup {
  group_id: string;
  name: string;
  description: string;
  topic: string;
  members_count: number;
  creation_date: string;
  last_activity: string;
  creator_username: string;
  creator_id: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function DiscoverGroups() {
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false
  });
  const [joiningGroupId, setJoiningGroupId] = useState<string>('');

  // Fetch public groups
  const fetchGroups = useCallback(async (page: number = 1, search: string = '') => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const response = await fetch(`/api/groups/discover?${params}`);
      const data = await response.json();

      if (data.success) {
        setGroups(data.groups);
        setPagination(data.pagination);
      } else {
        setError(data.error || 'Failed to load groups');
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle search
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    fetchGroups(1, searchQuery);
  }, [searchQuery, fetchGroups]);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchGroups(newPage, searchQuery);
    }
  }, [pagination.totalPages, searchQuery, fetchGroups]);

  // Join group
  const handleJoinGroup = useCallback(async (groupId: string) => {
    if (joiningGroupId) return; // Prevent double-clicking
    
    setJoiningGroupId(groupId);
    
    try {
      const response = await fetch('/api/groups/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ group_id: groupId })
      });

      const data = await response.json();

      if (data.success) {
        // Remove the joined group from the list
        setGroups(prev => prev.filter(group => group.group_id !== groupId));
        // Show success message with FBI terminology
        setError(''); // Clear any previous errors
        // You could add a success message state here if desired
      } else {
        setError(data.error || 'Network connection failed - access denied');
      }
    } catch (err) {
      console.error('Error joining group:', err);
      setError('Network connection failed - transmission error');
    } finally {
      setJoiningGroupId('');
    }
  }, [joiningGroupId]);

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateString);
  };

  useEffect(() => {
    fetchGroups(1, '');
  }, [fetchGroups]);

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="discover" />
      
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto mt-2 md:mt-4 lg:mt-8 p-2 md:p-4 lg:p-6 pb-8">
          {/* FBI-Style Header */}
          <div className="bg-black border-2 border-white rounded-none shadow-2xl mb-4 md:mb-6">
            <div className="border-b-2 border-white bg-white text-black p-3 md:p-4 text-center">
              <div className="font-mono text-xs mb-1">CLASSIFIED</div>
              <h1 className="text-lg md:text-2xl font-bold tracking-widest">OPERATION NETWORK DISCOVERY</h1>
              <div className="font-mono text-xs mt-1">PUBLIC ORGANIZATION REGISTRY</div>
            </div>
            <div className="p-3 md:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4 text-center text-xs font-mono mb-4">
                <div>
                  <div className="text-gray-400">ACTIVE NETWORKS</div>
                  <div className="text-lg md:text-xl font-bold">{pagination.totalCount.toString().padStart(3, '0')}</div>
                </div>
                <div>
                  <div className="text-gray-400">SURVEILLANCE STATUS</div>
                  <div className="text-lg md:text-xl font-bold text-green-400">{loading ? 'SCANNING...' : 'MONITORING'}</div>
                </div>
                <div>
                  <div className="text-gray-400">INFILTRATION LEVEL</div>
                  <div className="text-lg md:text-xl font-bold text-red-400">AUTHORIZED</div>
                </div>
              </div>

              {/* Search Section */}
              <div className="mb-4">
                <div className="text-xs font-mono text-gray-400 mb-2 text-center">ENTER SEARCH PARAMETERS:</div>
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="NETWORK NAME, DESCRIPTION, OR OPERATION CODE..."
                      className="w-full p-3 bg-black text-white border-2 border-white font-mono text-sm tracking-wider focus:outline-none focus:border-red-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 md:px-6 py-3 bg-white text-black font-mono text-xs md:text-sm tracking-wider hover:bg-gray-200 transition-colors"
                  >
                    EXECUTE SEARCH
                  </button>
                </form>
              </div>

              {error && (
                <div className="mb-4 text-center text-red-400 text-sm font-mono border border-red-400 bg-red-900/20 p-2">
                  ⚠ {error.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Networks Container */}
          <div className="bg-black border-2 border-white rounded-none shadow-2xl">
            {loading ? (
              <div className="text-center py-8 md:py-12 px-4">
                <div className="font-mono text-gray-400 mb-2 text-sm md:text-base">SCANNING PUBLIC NETWORKS...</div>
                <div className="text-red-400 animate-pulse">● ● ●</div>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 md:py-12 px-4">
                <div className="font-mono text-gray-400 mb-4 text-sm md:text-base">
                  {searchQuery ? `NO NETWORKS MATCHING "${searchQuery.toUpperCase()}"` : 'NO PUBLIC NETWORKS DETECTED'}
                </div>
                <div className="text-xs md:text-sm text-gray-500 font-mono">
                  {searchQuery ? 'REFINE SEARCH PARAMETERS OR CHECK CLEARANCE LEVEL' : 'BE THE FIRST TO ESTABLISH A PUBLIC NETWORK'}
                </div>
              </div>
            ) : (
              <div className="p-3 md:p-6">
                {/* Results Info */}
                <div className="mb-4 md:mb-6 text-center">
                  <div className="text-xs md:text-sm font-mono text-gray-400 mb-2">
                    DISPLAYING {groups.length} OF {pagination.totalCount} DETECTED NETWORKS
                    {searchQuery && (
                      <span className="block sm:inline sm:ml-2">MATCHING "{searchQuery.toUpperCase()}"</span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-gray-500">
                    PAGE {pagination.currentPage} OF {pagination.totalPages} - SECURITY LEVEL: PUBLIC ACCESS
                  </div>
                </div>

                {/* Networks Grid */}
                <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.map((group, index) => (
                    <div key={group.group_id} className="border border-gray-600 bg-gray-900/50 relative">
                      {/* Network Header */}
                      <div className="bg-white text-black p-2 font-mono text-xs">
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <span className="font-bold">NETWORK #{(index + 1).toString().padStart(3, '0')}</span>
                            <span className="text-xs">STATUS: PUBLIC</span>
                          </div>
                          <div className="text-xs">
                            MEMBERS: {group.members_count.toString().padStart(3, '0')}
                          </div>
                        </div>
                      </div>
                      
                      {/* Network Content */}
                      <div className="p-3 md:p-4">
                        {/* Network Info */}
                        <div className="mb-4">
                          <div className="font-mono text-sm md:text-base font-bold text-white mb-2 tracking-wider">
                            {group.name.toUpperCase()}
                          </div>
                          {group.topic && (
                            <div className="text-xs font-mono text-gray-400 mb-2">
                              OPERATION: {group.topic.toUpperCase()}
                            </div>
                          )}
                          <div className="text-xs md:text-sm text-gray-300 leading-relaxed mb-3">
                            {group.description || 'NO OPERATIONAL BRIEFING PROVIDED'}
                          </div>
                        </div>

                        {/* Network Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono mb-4">
                          <div>
                            <span className="text-gray-400">OPERATIVES:</span>
                            <div className="text-white font-bold">{group.members_count} ACTIVE</div>
                          </div>
                          <div>
                            <span className="text-gray-400">ESTABLISHED:</span>
                            <div className="text-white">{formatDate(group.creation_date).toUpperCase()}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">COMMANDER:</span>
                            <div className="text-white">AGENT-{group.creator_id.substring(0, 8).toUpperCase()}</div>
                          </div>
                        </div>

                        {/* Join Network Button */}
                        <button
                          onClick={() => handleJoinGroup(group.group_id)}
                          disabled={joiningGroupId === group.group_id}
                          className="w-full py-2 px-3 bg-white text-black font-mono text-xs md:text-sm tracking-wider hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {joiningGroupId === group.group_id ? 'JOINING...' : 'JOIN NETWORK'}
                        </button>
                      </div>
                      
                      {/* Security Footer */}
                      <div className="bg-green-900 text-white p-1 text-xs font-mono text-center border-t border-green-700">
                        ⚠ PUBLIC NETWORK - OPEN ACCESS AUTHORIZED ⚠
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mt-6">
                    <button
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={!pagination.hasPrev}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white text-black font-mono text-xs tracking-wider hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ◄ PREVIOUS
                    </button>
                    
                    <span className="text-xs font-mono text-gray-400 px-2">
                      PAGE {pagination.currentPage} OF {pagination.totalPages}
                    </span>
                    
                    <button
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={!pagination.hasNext}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white text-black font-mono text-xs tracking-wider hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      NEXT ►
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
