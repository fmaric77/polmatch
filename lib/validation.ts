import { NextResponse } from 'next/server';

// Input validation utilities for API endpoints
export interface ValidationResult {
  isValid: boolean;
  error?: string;
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
 * Validates password
 */
export function validatePassword(password: unknown): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }
  
  if (password.length > 128) {
    return { isValid: false, error: 'Password is too long' };
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
