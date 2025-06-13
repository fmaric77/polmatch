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

// Utility function to detect image URLs
const detectImageURL = (text: string): string | null => {
  const imageRegex = /https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg)(?:\?[^\s]*)?/i;
  const match = text.match(imageRegex);
  return match ? match[0] : null;
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

// Image embed component
interface ImageEmbedProps {
  imageUrl: string;
  content: string;
}

const ImageEmbed: React.FC<ImageEmbedProps> = ({ imageUrl, content }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showFullSize, setShowFullSize] = useState(false);

  return (
    <div className="space-y-2">
      <p className="leading-relaxed">{content}</p>
      {!imageError ? (
        <>
          <div className="bg-black/40 border border-gray-600 rounded-lg p-3 max-w-md">
            <div className="flex items-center space-x-2 mb-2">
              <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">IMAGE</div>
              <span className="text-gray-400 text-xs">Click to view full size</span>
            </div>
            <div 
              className="relative cursor-pointer rounded overflow-hidden"
              onClick={() => setShowFullSize(true)}
            >
              <img
                src={imageUrl}
                alt="Shared image"
                className="w-full h-auto max-h-64 object-contain bg-gray-900"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                style={{ display: imageLoaded ? 'block' : 'none' }}
              />
              {!imageLoaded && !imageError && (
                <div className="flex items-center justify-center h-32 bg-gray-800 text-gray-400">
                  Loading image...
                </div>
              )}
            </div>
          </div>
          
          {/* Full size overlay */}
          {showFullSize && (
            <div 
              className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
              onClick={() => setShowFullSize(false)}
            >
              <div className="relative max-w-full max-h-full">
                <img
                  src={imageUrl}
                  alt="Shared image - full size"
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullSize(false);
                  }}
                  className="absolute top-4 right-4 bg-black/70 text-white p-2 rounded hover:bg-black/90 transition-colors"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-3 max-w-md">
          <div className="flex items-center space-x-2 mb-2">
            <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">IMAGE</div>
            <span className="text-red-400 text-xs">Failed to load</span>
          </div>
          <p className="text-red-300 text-sm">Could not load image from: {imageUrl}</p>
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
  const imageUrl = detectImageURL(content);
  
  // Prioritize YouTube if both are detected (in case someone shares a YouTube link with image in description)
  if (youtubeVideoId) {
    return <YouTubeEmbed videoId={youtubeVideoId} content={content} />;
  }
  
  if (imageUrl) {
    return <ImageEmbed imageUrl={imageUrl} content={content} />;
  }
  
  return <p className="leading-relaxed">{content}</p>;
};

export default MessageContent;