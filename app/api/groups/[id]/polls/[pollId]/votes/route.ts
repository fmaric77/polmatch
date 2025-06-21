import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../../../../lib/mongodb-connection';

interface PollOption {
  option_id: string;
  text: string;
}

interface Poll {
  poll_id: string;
  group_id: string;
  question: string;
  options: PollOption[];
  expires_at?: string;
}

// GET: list vote counts and user's vote
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const { db } = await connectToDatabase();
  const { id: groupId, pollId } = await params;

  // fetch options of poll
  const poll = await db.collection('group_polls').findOne({ poll_id: pollId, group_id: groupId });
  if (!poll) {
    return NextResponse.json({ success: false, message: 'Poll not found' }, { status: 404 });
  }

  // aggregate votes
  const votes = await db.collection('group_poll_votes').aggregate([
    { $match: { poll_id: pollId } },
    { $group: { _id: '$option_id', count: { $sum: 1 } } }
  ]).toArray();

  // get user vote
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  let userVote: string | null = null;
  if (sessionToken) {
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (session) {
      const vote = await db.collection('group_poll_votes').findOne({ poll_id: pollId, user_id: session.user_id });
      userVote = vote?.option_id || null;
    }
  }

  return NextResponse.json({ success: true, poll_id: pollId, votes, userVote });
}

// POST: cast a vote for an option
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; pollId: string }> }): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await connectToDatabase();
  const session = await db.collection('sessions').findOne({ sessionToken });
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: groupId, pollId } = await params;
  const { optionId } = await req.json();

  // validate poll exists and option belongs
  const poll = await db.collection('group_polls').findOne({ poll_id: pollId, group_id: groupId }) as Poll | null;
  if (!poll) {
    return NextResponse.json({ success: false, message: 'Poll not found' }, { status: 404 });
  }
  
  // Check if poll has expired
  if (poll.expires_at && new Date() > new Date(poll.expires_at)) {
    return NextResponse.json({ success: false, message: 'Poll has expired' }, { status: 400 });
  }
  
  const validOption = poll.options.find((o: PollOption) => o.option_id === optionId);
  if (!validOption) {
    return NextResponse.json({ success: false, message: 'Invalid option' }, { status: 400 });
  }

  // remove existing vote
  await db.collection('group_poll_votes').deleteMany({ poll_id: pollId, user_id: session.user_id });

  // insert new vote
  await db.collection('group_poll_votes').insertOne({
    poll_id: pollId,
    user_id: session.user_id,
    option_id: optionId,
    voted_at: new Date().toISOString()
  });

  return NextResponse.json({ success: true });
}