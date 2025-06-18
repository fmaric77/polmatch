import crypto from 'crypto';

/**
 * Generates a consistent anonymous ID for a user
 * Uses a hash of the user ID to ensure the same user always gets the same anonymous ID
 * but the original user ID cannot be reverse-engineered
 */
export function generateAnonymousId(userId: string): string {
  const hash = crypto.createHash('sha256').update(userId).digest('hex');
  return hash.substring(0, 8).toUpperCase();
}

/**
 * Generates a display name that doesn't expose the real user ID
 * Falls back to using an anonymous ID if no display name is provided
 */
export function getAnonymousDisplayName(
  displayName?: string | null, 
  username?: string | null, 
  userId?: string
): string {
  if (displayName && displayName.trim()) {
    return displayName.toUpperCase();
  }
  
  if (username && username.trim()) {
    return username.toUpperCase();
  }
  
  if (userId) {
    return `USER-${generateAnonymousId(userId)}`;
  }
  
  return 'UNKNOWN-USER';
}

/**
 * Interface for user data that can be sanitized
 */
interface UserData {
  user_id: string;
  username?: string;
  display_name?: string;
  profile_picture_url?: string;
  email?: string;
  phone?: string;
  ip_address?: string;
  [key: string]: unknown;
}

/**
 * Sanitizes user data by removing or anonymizing sensitive fields
 */
export function sanitizeUserData(user: UserData | null): UserData | null {
  if (!user) return user;
  
  return {
    ...user,
    user_id: generateAnonymousId(user.user_id), // Replace real ID with anonymous ID
    // Keep other fields as they are
    username: user.username,
    display_name: user.display_name,
    profile_picture_url: user.profile_picture_url,
    // Remove any other potentially sensitive fields
    email: undefined,
    phone: undefined,
    ip_address: undefined,
  };
}

/**
 * Creates a mapping between real user IDs and anonymous IDs for internal use
 * This should only be used server-side for database operations
 */
export function createUserIdMapping(users: UserData[]): Map<string, string> {
  const mapping = new Map<string, string>();
  users.forEach(user => {
    if (user.user_id) {
      mapping.set(generateAnonymousId(user.user_id), user.user_id);
    }
  });
  return mapping;
}
