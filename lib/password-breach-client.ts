/**
 * Client-side password breach checking using HaveIBeenPwned API
 * Uses k-anonymity - only sends first 5 characters of SHA-1 hash
 */

/**
 * Check if password has been breached using HaveIBeenPwned API (client-side)
 * Uses Web Crypto API for hashing (works in modern browsers)
 */
export async function checkPasswordBreach(password: string): Promise<{ isBreached: boolean; count?: number }> {
  try {
    // Create SHA-1 hash of password using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    // Query HaveIBeenPwned API with first 5 characters
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'Polmatch-Password-Validator/1.0'
      }
    });
    
    if (!response.ok) {
      // If API fails, don't block password (fail open for availability)
      console.warn('Failed to check password breach status:', response.status);
      return { isBreached: false };
    }
    
    const data_text = await response.text();
    
    // Check if our password hash suffix appears in the results
    const lines = data_text.split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix?.trim() === suffix) {
        const count = parseInt(countStr?.trim() || '0', 10);
        return { isBreached: true, count };
      }
    }
    
    return { isBreached: false };
  } catch (error) {
    // If API fails, don't block password (fail open for availability)
    console.warn('Error checking password breach status:', error);
    return { isBreached: false };
  }
}

/**
 * Debounced password breach checker to avoid excessive API calls
 */
export function createDebouncedBreachChecker(delay: number = 500) {
  let timeoutId: NodeJS.Timeout;
  
  return function(password: string, callback: (result: { isBreached: boolean; count?: number }) => void) {
    clearTimeout(timeoutId);
    
    timeoutId = setTimeout(async () => {
      if (password.length >= 6) { // Only check passwords that meet minimum length
        const result = await checkPasswordBreach(password);
        callback(result);
      }
    }, delay);
  };
} 