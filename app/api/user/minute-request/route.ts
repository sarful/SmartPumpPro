import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MinuteRequest from '@/models/MinuteRequest';
import User from '@/models/User';
import { auth } from '@/lib/auth';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';

function isMongoDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000;
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireWebMutationSession(['user']);
    if (authResult.response) return authResult.response;
    const { session } = authResult;

    let body: { minutes?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { minutes } = body ?? {};
    if (typeof minutes !== 'number' || Number.isNaN(minutes) || minutes <= 0) {
      return NextResponse.json({ error: 'minutes must be > 0' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.user.id).select({ adminId: 1 }).lean();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const existingPending = await MinuteRequest.findOne({
      userId: session.user.id,
      status: 'pending',
    }).lean();
    if (existingPending) {
      return NextResponse.json({ error: 'Pending request already exists' }, { status: 400 });
    }

    const reqDoc = await MinuteRequest.create({
      userId: session.user.id,
      adminId: user.adminId,
      minutes,
      status: 'pending',
    });

    return NextResponse.json({ success: true, request: reqDoc });
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return NextResponse.json({ error: 'Pending request already exists' }, { status: 400 });
    }
    console.error('user minute-request POST error', error);
    return NextResponse.json({ error: 'Failed to create minute request' }, { status: 500 });
  }
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
