import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import MinuteRequest from '@/models/MinuteRequest';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { requestId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { requestId } = body ?? {};
  if (!requestId) return NextResponse.json({ error: 'requestId is required' }, { status: 400 });

  await connectDB();

  const request = await MinuteRequest.findOne({
    _id: requestId,
    adminId: session.user.adminId,
    status: 'pending',
  }).populate('userId', 'username');
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const user = await User.findById(request.userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  user.availableMinutes = (user.availableMinutes ?? 0) + request.minutes;
  await user.save();

  request.status = 'approved';
  await request.save();

  const { logEvent } = await import('@/lib/usage-logger');
  await logEvent({
    adminId: session.user.adminId!,
    userId: request.userId,
    event: 'recharge',
    addedMinutes: request.minutes,
    meta: { requestId: request._id },
  });

  return NextResponse.json({ success: true, availableMinutes: user.availableMinutes });
}
