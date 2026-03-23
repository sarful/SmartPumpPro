import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';

export async function POST(req: NextRequest) {
  const authResult = await requireWebMutationSession(['master']);
  if (authResult.response) return authResult.response;

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId } = body ?? {};
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  await connectDB();
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { status: 'active', suspendReason: null },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({ success: true, userId: updated._id });
}
