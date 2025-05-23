import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({ 
      success: true, 
      message: 'Unified messages API is working',
      features: [
        'Direct messages',
        'Group messages', 
        'Group invitations',
        'Real-time updates',
        'Discord-like interface'
      ]
    });
  } catch {
    return NextResponse.json({ 
      success: false, 
      error: 'Server error' 
    }, { status: 500 });
  }
}
