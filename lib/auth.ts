import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

interface CreateSessionData {
  user_id: string;
  ip_address?: string;
  user_agent?: string;
}

interface SessionDocument {
  sessionToken: string;
  user_id: string;
  created_at: Date;
  expires: Date;
  ip_address?: string;
  user_agent?: string;
}

export async function createSession(data: CreateSessionData): Promise<string> {
  const sessionToken = uuidv4();
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  
  const client = new MongoClient(MONGODB_URI as string);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    const sessionDoc: SessionDocument = {
      sessionToken,
      user_id: data.user_id,
      created_at: now,
      expires,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    };
    
    await db.collection('sessions').insertOne(sessionDoc);
    
    return sessionToken;
  } finally {
    await client.close();
  }
}

export async function validateSession(sessionToken: string): Promise<{ valid: boolean; session?: SessionDocument; user?: Record<string, unknown> }> {
  if (!sessionToken) {
    return { valid: false };
  }
  
  const client = new MongoClient(MONGODB_URI as string);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    const session = await db.collection('sessions').findOne({ 
      sessionToken,
      expires: { $gt: new Date() } // Check expiry using the correct field
    }) as SessionDocument | null;
    
    if (!session) {
      return { valid: false };
    }
    
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    
    return { valid: true, session, user: user || undefined };
  } finally {
    await client.close();
  }
}

export async function deleteSession(sessionToken: string): Promise<void> {
  const client = new MongoClient(MONGODB_URI as string);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    await db.collection('sessions').deleteOne({ sessionToken });
  } finally {
    await client.close();
  }
}

export async function cleanupExpiredSessions(): Promise<number> {
  const client = new MongoClient(MONGODB_URI as string);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    const result = await db.collection('sessions').deleteMany({
      expires: { $lt: new Date() }
    });
    
    return result.deletedCount;
  } finally {
    await client.close();
  }
}
