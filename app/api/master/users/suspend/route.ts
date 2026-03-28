import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';
import { logEvent } from '@/lib/usage-logger';

export async function POST(req: NextRequest) {
  const authResult = await requireWebMutationSession(['master']);
  if (authResult.response) return authResult.response;

  let body: { userId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { userId, reason } = body ?? {};
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  await connectDB();
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { status: 'suspended', suspendReason: reason || 'Suspended by master' },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await logEvent({
    adminId: updated.adminId,
    userId,
    event: 'user_suspend',
    currentBalance: updated.availableMinutes,
    meta: { source: 'master_suspend', reason: updated.suspendReason || null },
  });

  return NextResponse.json({ success: true });
}
