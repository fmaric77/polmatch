import { NextResponse } from 'next/server';
import { handleCSRFTokenRequest } from '../../../lib/csrf-protection';

/**
 * GET: Generate a new CSRF token for the current session
 */
export async function GET(): Promise<NextResponse> {
  return handleCSRFTokenRequest();
} 