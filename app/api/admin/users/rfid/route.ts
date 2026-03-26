import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';
import { normalizeRfidUid } from '@/lib/card-mode';
import { enforceRateLimit } from '@/lib/api-guard';
import { logEvent } from '@/lib/usage-logger';

type Body = {
  userId?: string;
  rfidUid?: string | null;
};

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'admin-rfid', 40, 60_000);
  if (limited) return limited;

  const authResult = await requireWebMutationSession(['admin']);
  if (authResult.response) return authResult.response;
  const { session } = authResult;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId;
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ _id: userId, adminId: session.user.adminId });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const normalized = normalizeRfidUid(body.rfidUid ?? undefined);

  // Unassign when empty/null.
  if (!normalized) {
    user.rfidUid = undefined;
    await user.save();
    await logEvent({
      adminId: session.user.adminId!,
      userId: user._id,
      event: 'attendance',
      meta: { action: 'rfid_unassigned' },
    });
    return NextResponse.json({ success: true, rfidUid: null });
  }

  const existing = await User.findOne({
    adminId: session.user.adminId,
    rfidUid: normalized,
    _id: { $ne: user._id },
  })
    .select({ _id: 1 })
    .lean();
  if (existing) {
    return NextResponse.json({ error: 'RFID card already assigned to another user' }, { status: 400 });
  }

  user.rfidUid = normalized;
  await user.save();

  await logEvent({
    adminId: session.user.adminId!,
    userId: user._id,
    event: 'attendance',
    meta: { action: 'rfid_assigned', rfidUid: normalized },
  });

  return NextResponse.json({ success: true, rfidUid: normalized });
}
