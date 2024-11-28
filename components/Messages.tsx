import React, { useState } from 'react';

const Messages = () => {
  const [expandedThreadId, setExpandedThreadId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const threads = [
    {
      id: 1,
      participants: ["Alice", "Bob"],
      messages: [
        { sender: "Alice", time: "10:00 AM", content: "Hello, how are you?" },
        { sender: "Bob", time: "10:05 AM", content: "I'm good, thanks! How about you?" },
        { sender: "Alice", time: "10:10 AM", content: "I'm doing well. Thanks for asking!" },
      ],
    },
    {
      id: 2,
      participants: ["Charlie", "Dave"],
      messages: [
        { sender: "Charlie", time: "11:00 AM", content: "Are you coming to the meeting?" },
        { sender: "Dave", time: "11:05 AM", content: "Yes, I'll be there." },
        { sender: "Charlie", time: "11:10 AM", content: "Great, see you then!" },
      ],
    },
    // Add more threads as needed
  ];

  const handleClick = (threadId: number) => {
    setExpandedThreadId(expandedThreadId === threadId ? null : threadId);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <div className="w-full max-w-3xl mx-auto p-4">
        {/* Header with title and New Message button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Messages</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-black px-4 py-2 rounded"
          >
            New Message
          </button>
        </div>
        {threads.map((thread) => (
          <div key={thread.id} className="mb-4">
            {/* Thread Header */}
            <div
              className="bg-black border border-white p-4 rounded cursor-pointer flex justify-between items-center"
              onClick={() => handleClick(thread.id)}
            >
              <div>
                <h2 className="text-xl font-semibold">
                  Conversation with {thread.participants.join(", ")}
                </h2>
                <p className="text-sm">
                  Last message at {thread.messages[thread.messages.length - 1].time}
                </p>
              </div>
              <span>{expandedThreadId === thread.id ? '▲' : '▼'}</span>
            </div>
            {/* Expanded Thread Messages */}
            {expandedThreadId === thread.id && (
              <div className="mt-2">
                {/* Original Message */}
                <div className="p-4 rounded border border-white bg-black">
                  <h3 className="font-semibold">
                    {thread.messages[0].sender} (Original Message)
                  </h3>
                  <p className="text-sm">{thread.messages[0].time}</p>
                  <p className="mt-2">{thread.messages[0].content}</p>
                </div>
                {/* Responses */}
                {thread.messages.slice(1).map((message, index) => (
                  <div key={index} className="p-4 rounded border border-white bg-black mt-2">
                    <h3 className="font-semibold">{message.sender}</h3>
                    <p className="text-sm">{message.time}</p>
                    <p className="mt-2">{message.content}</p>
                  </div>
                ))}
                {/* Reply Input */}
                <div className="mt-4">
                  <textarea
                    className="w-full bg-black border border-white text-white p-2 rounded focus:outline-none"
                    rows={3}
                    placeholder="Type your message..."
                  ></textarea>
                  <button className="mt-2 bg-white text-black px-4 py-2 rounded">
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Modal for New Message */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80">
          <div className="bg-black border border-white p-6 rounded max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">New Message</h2>
            <div className="mb-4">
              <label className="block mb-1">Subject</label>
              <input
                type="text"
                className="w-full bg-black border border-white text-white p-2 rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1">Message</label>
              <textarea
                className="w-full bg-black border border-white text-white p-2 rounded"
                rows={5}
              ></textarea>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="mr-2 bg-white text-black px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button className="bg-white text-black px-4 py-2 rounded">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;