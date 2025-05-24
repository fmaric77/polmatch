'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-solid-svg-icons';

interface ProfileAvatarProps {
  userId: string;
  size?: number;
  className?: string;
  showFallback?: boolean;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ 
  userId, 
  size = 40, 
  className = '', 
  showFallback = true 
}) => {
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfilePicture = async () => {
      try {
        console.log('Fetching profile picture for user:', userId);
        const response = await fetch(`/api/users/profile-picture?user_id=${userId}`);
        const data = await response.json();
        
        console.log('Profile picture API response:', data);
        
        if (data.success && data.profile_picture_url) {
          console.log('Setting profile picture URL:', data.profile_picture_url);
          setProfilePictureUrl(data.profile_picture_url);
        } else {
          console.log('No profile picture URL found or API error');
        }
      } catch (error) {
        console.error('Error fetching profile picture:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchProfilePicture();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const handleImageError = () => {
    console.log('Image failed to load:', profilePictureUrl);
    setImageError(true);
  };

  // Show fallback icon if no image URL, image failed to load, or loading
  if (loading || !profilePictureUrl || imageError) {
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
};

export default ProfileAvatar;
