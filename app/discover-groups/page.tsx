"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { useCSRFToken } from '@/components/hooks/useCSRFToken';

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
  const { protectedFetch } = useCSRFToken();
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
        limit: '20',
        profile_type: 'basic' // Default to basic profile for now
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
      const response = await protectedFetch('/api/groups/join', {
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
        setError(''); // Clear any previous errors
      } else {
        setError(data.error || 'Failed to join group');
      }
    } catch (err) {
      console.error('Error joining group:', err);
      setError('Failed to join group');
    } finally {
      setJoiningGroupId('');
    }
  }, [joiningGroupId, protectedFetch]);

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  useEffect(() => {
    fetchGroups(1, '');
  }, [fetchGroups]);

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="discover" />
      
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto mt-4 lg:mt-6 p-4 lg:p-6 pb-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Discover Groups</h1>
            <p className="text-gray-400 text-sm">Find and join public groups that match your interests</p>
          </div>

          {/* Search Section */}
          <div className="bg-black/40 border border-white/30 rounded-lg mb-6">
            <div className="p-4">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search groups..."
                    className="w-full p-3 bg-black text-white border border-white/30 rounded text-sm focus:outline-none focus:border-white/60"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-white text-black text-sm rounded hover:bg-gray-200 transition-colors"
                >
                  Search
                </button>
              </form>

              {error && (
                <div className="mt-3 text-center text-red-400 text-sm bg-red-900/20 border border-red-400/50 rounded p-2">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Groups Container */}
          <div className="bg-black/40 border border-white/30 rounded-lg">
            {loading ? (
              <div className="text-center py-12 px-4">
                <div className="text-gray-400 mb-2">Loading groups...</div>
                <div className="text-white/60 animate-pulse">● ● ●</div>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-gray-400 mb-4">
                  {searchQuery ? `No groups found matching &quot;${searchQuery}&quot;` : 'No groups available'}
                </div>
                <div className="text-sm text-gray-500">
                  {searchQuery ? 'Try different search terms' : 'Be the first to create a group'}
                </div>
              </div>
            ) : (
              <div className="p-4">
                {/* Results Info */}
                <div className="mb-6 text-center">
                  <div className="text-sm text-gray-400 mb-1">
                    {groups.length} of {pagination.totalCount} groups
                    {searchQuery && (
                      <span className="ml-2">matching &quot;{searchQuery}&quot;</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </div>
                </div>

                {/* Groups Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.map((group) => (
                    <div key={group.group_id} className="border border-white/30 bg-black/60 rounded-lg overflow-hidden">
                      {/* Group Content */}
                      <div className="p-4">
                        {/* Group Name */}
                        <div className="mb-3">
                          <h3 className="text-lg font-semibold text-white mb-1">
                            {group.name}
                          </h3>
                          {group.topic && (
                            <div className="text-xs text-gray-400 mb-2">
                              {group.topic}
                            </div>
                          )}
                          <p className="text-sm text-gray-300 leading-relaxed">
                            {group.description || 'No description available'}
                          </p>
                        </div>

                        {/* Group Stats */}
                        <div className="flex justify-between text-xs text-gray-400 mb-4">
                          <span>{group.members_count} members</span>
                          <span>created {formatDate(group.creation_date)}</span>
                        </div>

                        {/* Join Group Button */}
                        <button
                          onClick={() => handleJoinGroup(group.group_id)}
                          disabled={joiningGroupId === group.group_id}
                          className="w-full py-2 px-3 bg-white text-black text-sm rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {joiningGroupId === group.group_id ? 'Joining...' : 'Join Group'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
                    <button
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={!pagination.hasPrev}
                      className="px-4 py-2 bg-white text-black text-sm rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    
                    <span className="text-sm text-gray-400 px-3">
                      Page {pagination.currentPage} of {pagination.totalPages}
                    </span>
                    
                    <button
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={!pagination.hasNext}
                      className="px-4 py-2 bg-white text-black text-sm rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next →
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
