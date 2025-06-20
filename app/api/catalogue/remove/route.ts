import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const body = await request.json();
    const { user_id, category } = body;

    if (!user_id || !category) {
      return NextResponse.json(
        { success: false, error: 'user_id and category are required' },
        { status: 400 }
      );
    }

    if (!['love', 'basic', 'business'].includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category. Must be love, basic, or business' },
        { status: 400 }
      );
    }

    // Get user session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    // Remove specific user+category from catalogue
    const result = await db.collection('user_catalogues').deleteOne({
      owner_user_id: session.user_id,
      catalogued_user_id: user_id,
      profile_type: category
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found in this category of catalogue' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User removed from ${category} catalogue`
    });

  } catch (error) {
    console.error('Error removing from catalogue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove from catalogue' },
      { status: 500 }
    );
  }
}
