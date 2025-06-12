'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import { profilePictureCache } from '../lib/profilePictureCache';

interface ProfileAvatarProps {
  userId: string;
  size?: number;
  className?: string;
  showFallback?: boolean;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = React.memo(({ 
  userId, 
  size = 40, 
  className = '', 
  showFallback = true 
}) => {
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchProfilePicture = async () => {
      try {
        const cachedUrl = await profilePictureCache.getProfilePicture(userId);
        if (isMounted) {
          setProfilePictureUrl(cachedUrl);
        }
      } catch (error) {
        console.error('Error fetching profile picture:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProfilePicture();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleImageError = () => {
    setImageError(true);
  };

  // Memoize the fallback component to prevent unnecessary re-renders
  const fallbackComponent = useMemo(() => {
    if (!showFallback) return null;
    
    return (
      <div 
        className={`flex items-center justify-center bg-gray-200 rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <FontAwesomeIcon 
          icon={faUser} 
          className="text-gray-600" 
          style={{ fontSize: size * 0.5 }}
        />
      </div>
    );
  }, [showFallback, className, size]);

  // Show fallback icon if no image URL, image failed to load, or loading
  if (loading || !profilePictureUrl || imageError) {
    return fallbackComponent;
  }

  return (
    <div 
      className={`relative rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={profilePictureUrl}
        alt="Profile picture"
        fill
        className="object-cover"
        onError={handleImageError}
        sizes={`${size}px`}
      />
    </div>
  );
});

ProfileAvatar.displayName = 'ProfileAvatar';

export default ProfileAvatar;
