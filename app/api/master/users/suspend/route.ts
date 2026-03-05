import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  return NextResponse.json({ success: true });
}
