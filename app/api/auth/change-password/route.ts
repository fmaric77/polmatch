import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { connectToDatabase, getAuthenticatedUser } from '../../../../lib/mongodb-connection';
import { 
  validatePassword, 
  validateRequestBody,
  createValidationErrorResponse
} from '../../../../lib/validation';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Get session token from cookies
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: No session token' },
        { status: 401 }
      );
    }

    // Authenticate user
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Invalid session' },
        { status: 401 }
      );
    }

    const { user, userId } = auth;

    // Parse request body
    const body = await request.json();

    // Validate request body structure
    const bodyValidation = validateRequestBody(body, ['oldPassword', 'newPassword', 'confirmPassword'], []);
    if (!bodyValidation.isValid) {
      return createValidationErrorResponse(bodyValidation.error!, 400);
    }

    const { oldPassword, newPassword, confirmPassword } = body;

    // Validate old password
    const oldPasswordValidation = validatePassword(oldPassword);
    if (!oldPasswordValidation.isValid) {
      return createValidationErrorResponse(`Old password error: ${oldPasswordValidation.error}`, 400);
    }

    // Validate new password
    const newPasswordValidation = validatePassword(newPassword);
    if (!newPasswordValidation.isValid) {
      return createValidationErrorResponse(`New password error: ${newPasswordValidation.error}`, 400);
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: 'New passwords do not match' },
        { status: 400 }
      );
    }

    // Check if new password is different from old password
    if (oldPassword === newPassword) {
      return NextResponse.json(
        { success: false, message: 'New password must be different from the current password' },
        { status: 400 }
      );
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password_hash as string);
    if (!isOldPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash new password
    const saltRounds = 12; // Use higher salt rounds for better security
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    const { db } = await connectToDatabase();
    const updateResult = await db.collection('users').updateOne(
      { user_id: userId },
      { 
        $set: { 
          password_hash: newPasswordHash,
          password_updated_at: new Date()
        } 
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Log the password change for security purposes
    await db.collection('security_logs').insertOne({
      user_id: userId,
      action: 'password_change',
      timestamp: new Date(),
      ip_address: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json(
      { success: true, message: 'Password changed successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Change password API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
