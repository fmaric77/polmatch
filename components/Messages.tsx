import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import DraggableThread from './DraggableThread';

const Messages = () => {
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [threads, setThreads] = useState([
    {
      id: "1",
      participants: ["Alice", "Bob"],
      messages: [
        { sender: "Alice", time: "10:00 AM", content: "Hello, how are you?" },
        { sender: "Bob", time: "10:05 AM", content: "I'm good, thanks! How about you?" },
        { sender: "Alice", time: "10:10 AM", content: "I'm doing well. Thanks for asking!" },
      ],
    },
    {
      id: "2",
      participants: ["Charlie", "Dave"],
      messages: [
        { sender: "Charlie", time: "11:00 AM", content: "Are you coming to the meeting?" },
        { sender: "Dave", time: "11:05 AM", content: "Yes, I'll be there." },
        { sender: "Charlie", time: "11:10 AM", content: "Great, see you then!" },
      ],
    },
    // Add more threads as needed
  ]);

  const handleClick = (threadId: string) => {
    setExpandedThreadId(expandedThreadId === threadId ? null : threadId);
  };

  const moveThread = (fromIndex: number, toIndex: number) => {
    const updatedThreads = [...threads];
    const [movedThread] = updatedThreads.splice(fromIndex, 1);
    updatedThreads.splice(toIndex, 0, movedThread);
    setThreads(updatedThreads);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col min-h-screen bg-black text-white">
        <div className="w-full max-w-3xl mx-auto p-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Messages</h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-black px-4 py-2 rounded"
            >
              New Message
            </button>
          </div>
          {threads.map((thread, index) => (
            <DraggableThread
              key={thread.id}
              index={index}
              thread={thread}
              moveThread={moveThread}
              expandedThreadId={expandedThreadId}
              handleClick={handleClick}
            />
          ))}
        </div>
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
    </DndProvider>
  );
};

export default Messages;