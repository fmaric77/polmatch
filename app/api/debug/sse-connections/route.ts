import { NextResponse } from 'next/server';
import { getActiveConnections, logActiveConnections } from '../../../../lib/sse-notifications';

export async function GET(): Promise<NextResponse> {
  try {
    // Log connections to console
    logActiveConnections();
    
    // Get connection counts
    const connections = getActiveConnections();
    
    // Convert Map to object for JSON serialization
    const connectionsObj: Record<string, number> = {};
    for (const [userId, count] of connections.entries()) {
      connectionsObj[userId] = count;
    }
    
    return NextResponse.json({
      success: true,
      activeConnections: connectionsObj,
      totalUsers: connections.size,
      totalConnections: Array.from(connections.values()).reduce((sum, count) => sum + count, 0)
    });
    
  } catch (error) {
    console.error('Error checking SSE connections:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check SSE connections'
    }, { status: 500 });
  }
}
