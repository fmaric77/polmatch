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
        // Optionally show success message
        alert('Successfully joined the group!');
      } else {
        setError(data.error || 'Failed to join group');
      }
    } catch (err) {
      console.error('Error joining group:', err);
      setError('Failed to join group');
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
    <div className="w-screen h-screen min-h-screen min-w-full bg-black text-white overflow-hidden">
      <div className="flex h-full">
        <Navigation currentPage="discover" />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-black/80 border-b border-white p-6">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold mb-4">Discover Public Groups</h1>
              
              {/* Search Form */}
              <form onSubmit={handleSearch} className="flex gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search groups by name, description, or topic..."
                    className="w-full p-3 bg-black border border-white rounded text-white placeholder-gray-400 focus:outline-none focus:border-gray-300"
                  />
                  <FontAwesomeIcon 
                    icon={faSearch} 
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-white text-black rounded hover:bg-gray-200 transition-colors font-medium"
                >
                  Search
                </button>
              </form>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-6">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-lg">Loading groups...</div>
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-xl mb-4">No public groups found</div>
                  <div className="text-gray-400">
                    {searchQuery ? 'Try adjusting your search terms' : 'Be the first to create a public group!'}
                  </div>
                </div>
              ) : (
                <>
                  {/* Results Info */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-sm text-gray-400">
                      Showing {groups.length} of {pagination.totalCount} groups
                      {searchQuery && (
                        <span> matching &ldquo;{searchQuery}&rdquo;</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      Page {pagination.currentPage} of {pagination.totalPages}
                    </div>
                  </div>

                  {/* Groups Grid */}
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {groups.map((group) => (
                      <div 
                        key={group.group_id}
                        className="bg-black/80 border border-white rounded-lg p-6 hover:border-gray-300 transition-colors"
                      >
                        {/* Group Header */}
                        <div className="mb-4">
                          <h3 className="text-xl font-bold mb-2 line-clamp-2">{group.name}</h3>
                          {group.topic && (
                            <div className="text-sm text-gray-400 mb-2">#{group.topic}</div>
                          )}
                        </div>

                        {/* Group Description */}
                        <p className="text-gray-300 text-sm mb-4 line-clamp-3 leading-relaxed">
                          {group.description || 'No description provided.'}
                        </p>

                        {/* Group Stats */}
                        <div className="space-y-2 mb-6 text-sm text-gray-400">
                          <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faUsers} className="w-3 h-3" />
                            <span>{group.members_count} members</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faCalendar} className="w-3 h-3" />
                            <span>Created {formatDate(group.creation_date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
                            <span>Active {formatRelativeTime(group.last_activity)}</span>
                          </div>
                          <div className="text-xs">
                            By @{group.creator_username}
                          </div>
                        </div>

                        {/* Join Button */}
                        <button
                          onClick={() => handleJoinGroup(group.group_id)}
                          disabled={joiningGroupId === group.group_id}
                          className="w-full py-2 px-4 bg-white text-black rounded hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {joiningGroupId === group.group_id ? (
                            'Joining...'
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
                              Join Group
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-8">
                      <button
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={!pagination.hasPrev}
                        className="flex items-center gap-2 px-4 py-2 bg-black border border-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
                        Previous
                      </button>
                      
                      <span className="text-sm text-gray-400">
                        Page {pagination.currentPage} of {pagination.totalPages}
                      </span>
                      
                      <button
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={!pagination.hasNext}
                        className="flex items-center gap-2 px-4 py-2 bg-black border border-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                        <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
