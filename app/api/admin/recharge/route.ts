import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { Types } from 'mongoose';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';

export async function POST(req: NextRequest) {
  const authResult = await requireWebMutationSession(['admin']);
  if (authResult.response) return authResult.response;
  const { session } = authResult;

  let body: { userId?: string; minutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, minutes } = body ?? {};
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (typeof minutes !== 'number' || Number.isNaN(minutes) || minutes <= 0) {
    return NextResponse.json({ error: 'minutes must be > 0' }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOneAndUpdate(
    { _id: userId, adminId: session.user.adminId },
    { $inc: { availableMinutes: minutes } },
    { returnDocument: 'after' },
  ).lean();

  if (!user) {
    return NextResponse.json({ error: 'User not found or not under your admin' }, { status: 404 });
  }

  const { logEvent } = await import('@/lib/usage-logger');
  await logEvent({
    adminId: session.user.adminId!,
    userId,
    event: 'recharge',
    addedMinutes: minutes,
  });

  return NextResponse.json({
    success: true,
    availableMinutes: user.availableMinutes,
  });
}
