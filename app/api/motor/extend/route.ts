import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Queue from '@/models/Queue';
import { auth } from '@/lib/auth';
import Admin from '@/models/Admin';

type Body = {
  userId?: string;
  minutes?: number;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { userId, minutes = 1 } = body ?? {};

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (typeof minutes !== 'number' || Number.isNaN(minutes) || minutes <= 0) {
      return NextResponse.json({ error: 'minutes must be > 0' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (session.user.role === 'user' && session.user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.user.role === 'admin' && session.user.adminId !== String(user.adminId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json({ error: 'User is suspended' }, { status: 403 });
    }

    const admin = await Admin.findById(user.adminId).select({ status: 1, suspendReason: 1 }).lean();
    if (admin && admin.status === 'suspended') {
      return NextResponse.json({ error: admin.suspendReason || 'Admin suspended' }, { status: 403 });
    }

    if (user.motorStatus !== 'RUNNING') {
      return NextResponse.json({ error: 'Motor not running' }, { status: 400 });
    }

    if ((user.availableMinutes ?? 0) < minutes) {
      return NextResponse.json({ error: 'Insufficient minutes' }, { status: 400 });
    }

    // Pre-deduct now; unused will be refunded on stop
    user.availableMinutes = Math.max((user.availableMinutes ?? 0) - minutes, 0);
    user.motorRunningTime = (user.motorRunningTime ?? 0) + minutes;
    user.lastSetMinutes = (user.lastSetMinutes ?? 0) + minutes;
    await user.save();

    await Queue.findOneAndUpdate(
      { adminId: user.adminId, userId: user._id, status: 'RUNNING' },
      { $inc: { requestedMinutes: minutes } },
    ).lean();

    return NextResponse.json({
      success: true,
      availableMinutes: user.availableMinutes,
      motorRunningTime: user.motorRunningTime,
    });
  } catch (error: any) {
    console.error('Motor extend error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
