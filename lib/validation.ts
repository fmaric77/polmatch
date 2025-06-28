import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Input validation utilities for API endpoints
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Check if password has been breached using HaveIBeenPwned API
 * Uses k-anonymity - only sends first 5 characters of SHA-1 hash
 */
async function checkPasswordBreach(password: string): Promise<{ isBreached: boolean; count?: number }> {
  try {
    // Create SHA-1 hash of password
    const hash = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
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
    
    const data = await response.text();
    
    // Check if our password hash suffix appears in the results
    const lines = data.split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix === suffix) {
        const count = parseInt(countStr, 10);
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
 * Validates if a string is a valid UUID format
 */
export function validateUUID(value: unknown): ValidationResult {
  if (typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a string' };
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return { isValid: false, error: 'Invalid UUID format' };
  }
  
  return { isValid: true };
}

/**
 * Validates group ID
 */
export function validateGroupId(groupId: unknown): ValidationResult {
  if (!groupId) {
    return { isValid: false, error: 'Group ID is required' };
  }
  
  return validateUUID(groupId);
}

/**
 * Validates user ID
 */
export function validateUserId(userId: unknown): ValidationResult {
  if (!userId) {
    return { isValid: false, error: 'User ID is required' };
  }
  
  return validateUUID(userId);
}

/**
 * Validates and sanitizes text input
 */
export function validateText(
  value: unknown, 
  fieldName: string, 
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  } = {}
): ValidationResult {
  if (options.required && (!value || value === '')) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  if (value && typeof value !== 'string') {
    return { isValid: false, error: `${fieldName} must be a string` };
  }
  
  const str = value as string;
  
  if (options.minLength && str.length < options.minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${options.minLength} characters` };
  }
  
  if (options.maxLength && str.length > options.maxLength) {
    return { isValid: false, error: `${fieldName} must be at most ${options.maxLength} characters` };
  }
  
  if (options.pattern && !options.pattern.test(str)) {
    return { isValid: false, error: `${fieldName} contains invalid characters` };
  }
  
  return { isValid: true };
}

/**
 * Validates email format
 */
export function validateEmail(email: unknown): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required and must be a string' };
  }
  
  if (email.length > 254) {
    return { isValid: false, error: 'Email is too long' };
  }
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  return { isValid: true };
}

/**
 * Validates username
 */
export function validateUsername(username: unknown): ValidationResult {
  return validateText(username, 'Username', {
    required: true,
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_-]+$/
  });
}

/**
 * Validates password with comprehensive security checks including breach detection
 */
export async function validatePassword(password: unknown, username?: string, email?: string): Promise<ValidationResult> {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }
  
  const str = password as string;
  
  if (str.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long' };
  }
  
  if (str.length > 128) {
    return { isValid: false, error: 'Password is too long (maximum 128 characters)' };
  }

  // Require at least one number
  if (!/\d/.test(str)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }
  
  // Require at least one special character (aligned with frontend)
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(str)) {
    return { isValid: false, error: 'Password must contain at least one special character (!@#$%^&*()_+-=[]{};"\':|,.<>/?)' };
  }

  // Check if password contains username or email
  const lower = str.toLowerCase();
  if (username && username.length > 2 && lower.includes(username.toLowerCase())) {
    return { isValid: false, error: 'Password cannot contain your username' };
  }
  
  if (email) {
    const emailPart = email.split('@')[0];
    if (emailPart.length > 2 && lower.includes(emailPart.toLowerCase())) {
      return { isValid: false, error: 'Password cannot contain part of your email address' };
    }
  }

  // Block common password patterns (expanded list)
  const commonPatterns = [
    // Simple patterns
    'password', 'pass', '1234', '123456', '12345678', '123456789', '1234567890',
    // Keyboard patterns  
    'qwerty', 'qwertyui', 'asdfgh', 'zxcvbn', 'qwer', 'asdf', 'zxcv',
    // Common combinations
    'abc123', 'password123', '123password', 'admin', 'login', 'welcome',
    // Dates and years
    '2024', '2023', '2022', '2021', '2020',
    // Common words
    'letmein', 'monkey', 'dragon', 'sunshine', 'master', 'shadow',
    'football', 'baseball', 'superman', 'batman', 'trustno1',
    // Repeated patterns
    'aaaaaa', '111111', '000000', 'abcabc', '123123'
  ];
  
  for (const pattern of commonPatterns) {
    if (lower.includes(pattern)) {
      return { isValid: false, error: `Password cannot contain common pattern "${pattern}"` };
    }
  }

  // Check for simple patterns
  if (/^(.)\1{5,}$/.test(str)) {
    return { isValid: false, error: 'Password cannot be the same character repeated' };
  }
  
  // Check for simple sequential patterns
  if (/01234|12345|23456|34567|45678|56789|abcde|bcdef|cdefg|defgh|efghi|fghij/i.test(str)) {
    return { isValid: false, error: 'Password cannot contain simple sequential patterns' };
  }

  // Check if password has been breached (async check)
  const breachCheck = await checkPasswordBreach(str);
  if (breachCheck.isBreached) {
    const count = breachCheck.count || 0;
    if (count > 10) {
      return { 
        isValid: false, 
        error: `This password has been found in ${count.toLocaleString()} data breaches and is not secure` 
      };
    } else {
      return { 
        isValid: false, 
        error: `This password has been found in data breaches ${count} time${count === 1 ? '' : 's'} and should not be used` 
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates JSON request body structure
 */
export function validateRequestBody(
  body: unknown,
  requiredFields: string[],
  optionalFields: string[] = []
): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { isValid: false, error: 'Request body must be a valid JSON object' };
  }
  
  const bodyObj = body as Record<string, unknown>;
  const allowedFields = [...requiredFields, ...optionalFields];
  
  // Check for required fields
  for (const field of requiredFields) {
    if (!(field in bodyObj) || bodyObj[field] === undefined || bodyObj[field] === null) {
      return { isValid: false, error: `Missing required field: ${field}` };
    }
  }
  
  // Check for unexpected fields
  for (const field in bodyObj) {
    if (!allowedFields.includes(field)) {
      return { isValid: false, error: `Unexpected field: ${field}` };
    }
  }
  
  return { isValid: true };
}

/**
 * Sanitizes text input to prevent injection attacks
 */
export function sanitizeText(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML/XML tags
    .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
    .substring(0, 1000); // Limit length
}

/**
 * Creates a validation error response
 */
export function createValidationErrorResponse(error: string, status: number = 400): NextResponse {
  return NextResponse.json({ 
    success: false, 
    error: error,
    timestamp: new Date().toISOString()
  }, { status });
}

/**
 * Rate limiting map for simple in-memory rate limiting
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple rate limiting function
 */
export function checkRateLimit(
  identifier: string, 
  maxRequests: number = 100, 
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  
  let rateLimitData = rateLimitMap.get(identifier);
  
  if (!rateLimitData || rateLimitData.resetTime < now) {
    rateLimitData = { count: 0, resetTime: now + windowMs };
    rateLimitMap.set(identifier, rateLimitData);
  }
  
  rateLimitData.count++;
  
  return rateLimitData.count <= maxRequests;
}

/**
 * Validates profile type
 */
export function validateProfileType(profileType: unknown): ValidationResult {
  const validTypes = ['basic', 'love', 'business'];
  
  if (!profileType || typeof profileType !== 'string') {
    return { isValid: false, error: 'Profile type is required and must be a string' };
  }
  
  if (!validTypes.includes(profileType)) {
    return { isValid: false, error: 'Invalid profile type. Must be: basic, love, or business' };
  }
  
  return { isValid: true };
}

/**
 * Validates group role
 */
export function validateGroupRole(role: unknown): ValidationResult {
  const validRoles = ['member', 'admin', 'owner'];
  
  if (!role || typeof role !== 'string') {
    return { isValid: false, error: 'Role is required and must be a string' };
  }
  
  if (!validRoles.includes(role)) {
    return { isValid: false, error: 'Invalid role. Must be: member, admin, or owner' };
  }
  
  return { isValid: true };
}
