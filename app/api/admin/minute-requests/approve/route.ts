import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MinuteRequest from '@/models/MinuteRequest';
import User from '@/models/User';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';

export async function POST(req: NextRequest) {
  const authResult = await requireWebMutationSession(['admin']);
  if (authResult.response) return authResult.response;
  const { session } = authResult;

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
