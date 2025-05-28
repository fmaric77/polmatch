import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';

// Utility function to detect YouTube URLs
const detectYouTubeURL = (text: string): string | null => {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = text.match(youtubeRegex);
  return match ? match[1] : null;
};

// YouTube embed component
interface YouTubeEmbedProps {
  videoId: string;
  content: string;
}

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ videoId, content }) => {
  const [showEmbed, setShowEmbed] = useState(false);

  return (
    <div className="space-y-2">
      <p className="leading-relaxed">{content}</p>
      {!showEmbed ? (
        <div 
          className="bg-black/40 border border-gray-600 rounded-lg p-3 cursor-pointer hover:bg-black/60 transition-colors"
          onClick={() => setShowEmbed(true)}
        >
          <div className="flex items-center space-x-3">
            <Image 
              src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
              alt="YouTube video thumbnail"
              width={80}
              height={60}
              className="object-cover rounded"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">YouTube</div>
              </div>
              <p className="text-white text-sm">Click to play video</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative bg-black rounded-lg overflow-hidden">
          <iframe
            width="400"
            height="225"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full aspect-video"
          ></iframe>
          <button
            onClick={() => setShowEmbed(false)}
            className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded hover:bg-black/90 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xs" />
          </button>
        </div>
      )}
    </div>
  );
};

// Enhanced message content renderer
interface MessageContentProps {
  content: string;
}

const MessageContent: React.FC<MessageContentProps> = ({ content }) => {
  const youtubeVideoId = detectYouTubeURL(content);
  
  if (youtubeVideoId) {
    return <YouTubeEmbed videoId={youtubeVideoId} content={content} />;
  }
  
  return <p className="leading-relaxed">{content}</p>;
};

export default MessageContent;