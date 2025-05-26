import React, { useEffect, useState } from 'react';

const DebugMessages = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDebugInfo = async () => {
      try {
        const debug = {
          session: null,
          privateConversations: null,
          messages: null,
          groups: null
        };

        // Check session
        const sessionRes = await fetch('/api/session');
        debug.session = await sessionRes.json();

        if (debug.session.valid) {
          // Check private conversations
          const privateRes = await fetch('/api/private-conversations');
          debug.privateConversations = await privateRes.json();

          // Check messages
          const messagesRes = await fetch('/api/messages');
          debug.messages = await messagesRes.json();

          // Check groups
          const groupsRes = await fetch('/api/groups/list');
          debug.groups = await groupsRes.json();
        }

        setDebugInfo(debug);
        setLoading(false);
      } catch (error) {
        console.error('Debug fetch error:', error);
        setLoading(false);
      }
    };

    fetchDebugInfo();
  }, []);

  if (loading) {
    return <div className="p-4 text-white">Loading debug info...</div>;
  }

  return (
    <div className="p-4 bg-black text-white font-mono text-sm">
      <h1 className="text-xl font-bold mb-4">Frontend Debug Information</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-green-400">Session:</h2>
          <pre className="bg-gray-800 p-2 rounded overflow-auto">
            {JSON.stringify(debugInfo.session, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-blue-400">Private Conversations:</h2>
          <pre className="bg-gray-800 p-2 rounded overflow-auto">
            {JSON.stringify(debugInfo.privateConversations, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-yellow-400">Messages:</h2>
          <pre className="bg-gray-800 p-2 rounded overflow-auto">
            {JSON.stringify(debugInfo.messages, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-purple-400">Groups:</h2>
          <pre className="bg-gray-800 p-2 rounded overflow-auto">
            {JSON.stringify(debugInfo.groups, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default DebugMessages;
