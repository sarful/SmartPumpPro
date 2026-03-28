import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';
import { logEvent } from '@/lib/usage-logger';

export async function POST(req: NextRequest) {
  const authResult = await requireWebMutationSession(['admin']);
  if (authResult.response) return authResult.response;
  const { session } = authResult;

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
    { _id: userId, adminId: session.user.adminId },
    { status: 'active', suspendReason: null },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) {
    const exists = await User.findOne({ _id: userId }).select({ adminId: 1 }).lean();
    if (exists) {
      return NextResponse.json({ error: 'User belongs to another admin' }, { status: 403 });
    }
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await logEvent({
    adminId: session.user.adminId!,
    userId: updated._id,
    event: 'user_unsuspend',
    currentBalance: updated.availableMinutes,
    meta: { source: 'admin_unsuspend' },
  });

  return NextResponse.json({ success: true, userId: updated._id });
}
