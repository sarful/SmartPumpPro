import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { calculateUsedMinutes, stopMotorForUser } from '@/lib/timer-engine';
import { auth } from '@/lib/auth';
import Queue from '@/models/Queue';

type StopMotorRequest = {
  userId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId }: StopMotorRequest = await req.json();

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (session.user.role === 'user' && session.user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.user.role === 'admin' && session.user.adminId !== String(user.adminId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If running/hold -> use normal stop flow
    if (user.motorStatus === 'RUNNING' || user.motorStatus === 'HOLD') {
      const usedMinutes = calculateUsedMinutes(user.motorStartTime, user.lastSetMinutes);
      const remaining =
        user.motorRunningTime && user.motorRunningTime > 0
          ? user.motorRunningTime
          : Math.max(user.lastSetMinutes - usedMinutes, 0);
      const refundedMinutes = Math.max(remaining, 0);

      await stopMotorForUser(userId);

      return NextResponse.json({
        success: true,
        usedMinutes,
        refundedMinutes,
      });
    }

    // If not running (queued/waiting) -> clear queue entry and reset fields
    await Queue.deleteMany({
      adminId: user.adminId,
      userId: user._id,
      status: { $in: ['WAITING', 'RUNNING'] },
    });

    user.motorRunningTime = 0;
    user.lastSetMinutes = 0;
    user.motorStartTime = null;
    user.motorStatus = 'OFF';
    await user.save();

    return NextResponse.json({ success: true, usedMinutes: 0, refundedMinutes: 0 });
  } catch (error) {
    console.error('Motor stop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
