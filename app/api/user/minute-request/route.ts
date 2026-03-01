import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import MinuteRequest from '@/models/MinuteRequest';
import User from '@/models/User';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'user') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { minutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { minutes } = body ?? {};
  if (!minutes || minutes <= 0) {
    return NextResponse.json({ error: 'minutes must be > 0' }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(session.user.id).select({ adminId: 1 }).lean();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const reqDoc = await MinuteRequest.create({
    userId: session.user.id,
    adminId: user.adminId,
    minutes,
    status: 'pending',
  });

  return NextResponse.json({ success: true, request: reqDoc });
}

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'user') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const items = await MinuteRequest.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  return NextResponse.json({ requests: items });
}
