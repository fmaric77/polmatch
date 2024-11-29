import React from 'react';
import { useDrag, useDrop } from 'react-dnd';

const ItemType = 'THREAD';

interface Thread {
  id: string;
  participants: string[];
  messages: {
    sender: string;
    time: string;
    content: string;
  }[];
}

interface DraggableThreadProps {
    thread: Thread;
    index: number;
    moveThread: (fromIndex: number, toIndex: number) => void;
    expandedThreadId: string | null;
    handleClick: (id: string) => void;
  }
const DraggableThread: React.FC<DraggableThreadProps> = ({ thread, index, moveThread, expandedThreadId, handleClick }) => {
  const ref = React.useRef(null);

  const [, drop] = useDrop({
    accept: ItemType,
    hover(item: { index: number }) {
      if (item.index !== index) {
        moveThread(item.index, index);
        item.index = index;
      }
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`mb-4 ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => handleClick(thread.id)}
    >
      <div className="bg-black border border-white p-4 rounded cursor-pointer flex justify-between items-center">
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
      {expandedThreadId === thread.id && (
        <div className="mt-2">
          <div className="p-4 rounded border border-white bg-black">
            <h3 className="font-semibold">
              {thread.messages[0].sender} (Original Message)
            </h3>
            <p className="text-sm">{thread.messages[0].time}</p>
            <p className="mt-2">{thread.messages[0].content}</p>
          </div>
          {thread.messages.slice(1).map((message, index) => (
            <div key={index} className="p-4 rounded border border-white bg-black mt-2">
              <h3 className="font-semibold">{message.sender}</h3>
              <p className="text-sm">{message.time}</p>
              <p className="mt-2">{message.content}</p>
            </div>
          ))}
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
  );
};

export default DraggableThread;