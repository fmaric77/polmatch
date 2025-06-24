/**
 * Image URL validation utilities
 */

// Supported image formats
const SUPPORTED_IMAGE_FORMATS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'
];

// Blocked domains for security
const BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '10.',
  '192.168.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.'
];

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validate image URL format and structure
 */
export function validateImageUrl(url: string): ImageValidationResult {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'Image URL is required' };
  }

  // Trim whitespace
  url = url.trim();

  if (!url) {
    return { isValid: false, error: 'Image URL cannot be empty' };
  }

  // Check URL length
  if (url.length > 2048) {
    return { isValid: false, error: 'Image URL is too long (max 2048 characters)' };
  }

  // Basic URL format validation
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }

  // Only allow HTTP and HTTPS protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { isValid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
  }

  // Security check - block local/private IPs
  const hostname = parsedUrl.hostname.toLowerCase();
  const isBlocked = BLOCKED_DOMAINS.some(blocked => {
    if (blocked.endsWith('.')) {
      return hostname.startsWith(blocked);
    }
    return hostname === blocked || hostname.includes(blocked);
  });

  if (isBlocked) {
    return { isValid: false, error: 'Local and private network URLs are not allowed' };
  }

  // Check for suspicious patterns
  if (url.includes('javascript:') || url.includes('data:') || url.includes('vbscript:')) {
    return { isValid: false, error: 'Potentially unsafe URL detected' };
  }

  // Extract file extension
  const pathname = parsedUrl.pathname.toLowerCase();
  const extension = pathname.split('.').pop();

  if (!extension) {
    return { isValid: false, error: 'Image URL must have a file extension' };
  }

  // Check if extension is supported
  if (!SUPPORTED_IMAGE_FORMATS.includes(extension)) {
    return { 
      isValid: false, 
      error: `Unsupported image format. Supported formats: ${SUPPORTED_IMAGE_FORMATS.join(', ')}` 
    };
  }

  const warnings: string[] = [];

  // Warn about HTTP (non-secure) URLs
  if (parsedUrl.protocol === 'http:') {
    warnings.push('Consider using HTTPS for better security');
  }

  // Warn about very long URLs
  if (url.length > 500) {
    warnings.push('Very long URLs may cause display issues');
  }

  return { 
    isValid: true, 
    warnings: warnings.length > 0 ? warnings : undefined 
  };
}

/**
 * Validate image URL by attempting to load it
 */
export async function validateImageUrlByLoading(url: string): Promise<ImageValidationResult> {
  const basicValidation = validateImageUrl(url);
  if (!basicValidation.isValid) {
    return basicValidation;
  }

  try {
    // Create a promise that resolves/rejects based on image loading
    const isValidImage = await new Promise<boolean>((resolve) => {
      const img = new Image();
      
      // Set up timeout
      const timeout = setTimeout(() => {
        resolve(false);
      }, 10000); // 10 second timeout

      img.onload = () => {
        clearTimeout(timeout);
        
        // Check image dimensions (optional - prevent extremely large images)
        if (img.naturalWidth > 5000 || img.naturalHeight > 5000) {
          resolve(false);
        } else {
          resolve(true);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };

      img.src = url;
    });

    if (!isValidImage) {
      return { isValid: false, error: 'Unable to load image from URL' };
    }

    return { isValid: true, warnings: basicValidation.warnings };

  } catch {
    return { isValid: false, error: 'Failed to validate image URL' };
  }
}

/**
 * Client-side image URL validation hook for React components
 */
export function useImageValidation() {
  const validateUrl = (url: string): ImageValidationResult => {
    return validateImageUrl(url);
  };

  const validateUrlWithLoading = async (url: string): Promise<ImageValidationResult> => {
    if (typeof window === 'undefined') {
      // Server-side - only do basic validation
      return validateImageUrl(url);
    }
    
    return validateImageUrlByLoading(url);
  };

  return {
    validateUrl,
    validateUrlWithLoading,
    supportedFormats: SUPPORTED_IMAGE_FORMATS
  };
} 