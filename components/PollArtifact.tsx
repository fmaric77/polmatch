import React, { useState, useEffect, useCallback } from 'react';

interface PollOption {
  option_id: string;
  text: string;
}

interface PollData {
  poll_id: string;
  question: string;
  options: PollOption[];
  expires_at?: string;
}

interface PollVote {
  _id: string;
  count: number;
}

interface PollResult {
  votes: PollVote[];
  userVote: string | null;
}

interface PollArtifactProps {
  pollData: PollData;
  onVote: (pollId: string, optionId: string) => void;
  pollResults?: PollResult; // Make optional since component will fetch its own
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  groupId?: string; // Add groupId to fetch poll results
}

const PollArtifact: React.FC<PollArtifactProps> = ({
  pollData,
  onVote,
  pollResults: initialPollResults,
  currentUser,
  groupId
}) => {
  const [pollResults, setPollResults] = useState<PollResult | undefined>(initialPollResults);

  // Fetch poll results if not provided
  const fetchPollResults = useCallback(async () => {
    if (!groupId) return;
    try {
      const response = await fetch(`/api/groups/${groupId}/polls/${pollData.poll_id}/votes`);
      const data = await response.json();
      if (data.success) {
        setPollResults({ votes: data.votes, userVote: data.userVote });
      }
    } catch (error) {
      console.error('Error fetching poll results:', error);
    }
  }, [groupId, pollData.poll_id]);

  // Fetch poll results on mount if not provided
  useEffect(() => {
    if (!initialPollResults && groupId) {
      fetchPollResults();
    }
  }, [initialPollResults, groupId, fetchPollResults]);

  // Handle voting with local refresh
  const handleVote = useCallback(async (pollId: string, optionId: string) => {
    await onVote(pollId, optionId);
    // Refresh poll results after voting
    if (groupId) {
      await fetchPollResults();
    }
  }, [onVote, groupId, fetchPollResults]);
  const isExpired = pollData.expires_at ? new Date() > new Date(pollData.expires_at) : false;
  const hasVoted = !!pollResults?.userVote;
  const totalVotes = pollResults?.votes.reduce((sum, vote) => sum + vote.count, 0) || 0;

  const getTimeUntilExpiry = (): string => {
    if (!pollData.expires_at) return '';
    
    const now = new Date();
    const expiry = new Date(pollData.expires_at);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'EXPIRED';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  return (
    <div className="bg-gray-900 border-2 border-purple-400 rounded-none p-4 font-mono">
      {/* Poll Header */}
      <div className="flex items-center justify-between mb-3 border-b border-purple-400 pb-2">
        <div className="flex items-center space-x-2">
          <span className="text-purple-400 text-lg">📊</span>
          <span className="text-purple-400 font-mono uppercase tracking-widest text-xs">Poll</span>
        </div>
        <div className="flex flex-col items-end text-xs text-gray-400 font-mono">
          <div>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</div>
          {pollData.expires_at && (
            <div className={`${isExpired ? 'text-red-400' : 'text-yellow-400'}`}>
              {getTimeUntilExpiry()}
            </div>
          )}
        </div>
      </div>

      {/* Poll Question */}
      <div className="text-white font-medium mb-4 font-mono uppercase tracking-wide">
        {pollData.question}
      </div>

      {/* Poll Options */}
      <div className="space-y-2">
        {pollData.options.map(option => {
          const voteCount = pollResults?.votes.find(v => v._id === option.option_id)?.count || 0;
          const isUserChoice = pollResults?.userVote === option.option_id;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const canVote = !hasVoted && !isExpired && currentUser;

          return (
            <div key={option.option_id} className="relative">
              <button
                onClick={() => canVote && handleVote(pollData.poll_id, option.option_id)}
                disabled={!canVote}
                className={`w-full text-left p-3 rounded-none border-2 transition-all font-mono relative overflow-hidden ${
                  isUserChoice
                    ? 'bg-green-600 border-green-400 text-white shadow-green-400/30'
                    : isExpired
                      ? 'bg-gray-800 border-gray-600 text-gray-400 cursor-not-allowed'
                      : hasVoted
                        ? 'bg-gray-800 border-gray-600 text-gray-300 cursor-not-allowed'
                        : 'bg-black border-white text-white hover:bg-white hover:text-black'
                }`}
              >
                {/* Vote percentage bar */}
                {hasVoted && (
                  <div 
                    className="absolute inset-0 bg-blue-600/20 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                )}
                
                <div className="relative flex items-center justify-between">
                  <span className="flex-1">{option.text}</span>
                  <div className="flex items-center space-x-2 text-sm">
                    {isUserChoice && <span className="text-green-300">✓</span>}
                    {hasVoted && (
                      <>
                        <span>{voteCount}</span>
                        <span className="text-gray-400">({percentage}%)</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Poll Status */}
      <div className="mt-3 pt-2 border-t border-gray-600 text-xs font-mono uppercase tracking-widest">
        {isExpired ? (
          <span className="text-red-400">Poll Expired</span>
        ) : hasVoted ? (
          <span className="text-green-400">You Voted</span>
        ) : (
          <span className="text-blue-400">Click to Vote</span>
        )}
      </div>
    </div>
  );
};

export default PollArtifact;