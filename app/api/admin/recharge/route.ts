import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { Types } from 'mongoose';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    { new: true },
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
