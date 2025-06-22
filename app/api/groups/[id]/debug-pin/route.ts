import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'Debug pin route is working!',
    method: 'GET'
  });
}

export async function POST() {
  return NextResponse.json({ 
    success: true, 
    message: 'Debug pin route POST is working!',
    method: 'POST'
  });
}

export async function DELETE() {
  return NextResponse.json({ 
    success: true, 
    message: 'Debug pin route DELETE is working!',
    method: 'DELETE'
  });
}
