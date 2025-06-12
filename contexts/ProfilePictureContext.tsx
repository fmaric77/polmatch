'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { profilePictureCache } from '../lib/profilePictureCache';

interface ProfilePictureContextType {
  getProfilePicture: (userId: string) => Promise<string | null>;
  invalidateUser: (userId: string) => void;
  prefetchProfilePictures: (userIds: string[]) => Promise<void>;
}

const ProfilePictureContext = createContext<ProfilePictureContextType | undefined>(undefined);

export const ProfilePictureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getProfilePicture = useCallback(async (userId: string): Promise<string | null> => {
    return profilePictureCache.getProfilePicture(userId);
  }, []);

  const invalidateUser = useCallback((userId: string): void => {
    profilePictureCache.invalidateUser(userId);
  }, []);

  const prefetchProfilePictures = useCallback(async (userIds: string[]): Promise<void> => {
    // Batch prefetch profile pictures for multiple users
    const promises = userIds.map(userId => profilePictureCache.getProfilePicture(userId));
    await Promise.allSettled(promises);
  }, []);

  const value: ProfilePictureContextType = {
    getProfilePicture,
    invalidateUser,
    prefetchProfilePictures
  };

  return (
    <ProfilePictureContext.Provider value={value}>
      {children}
    </ProfilePictureContext.Provider>
  );
};

export const useProfilePicture = (): ProfilePictureContextType => {
  const context = useContext(ProfilePictureContext);
  if (context === undefined) {
    throw new Error('useProfilePicture must be used within a ProfilePictureProvider');
  }
  return context;
};
