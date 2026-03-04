import { NextResponse, NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { addToQueue, getQueuePosition, isMotorBusy } from '@/lib/queue-engine';
import { auth } from '@/lib/auth';
import Admin from '@/models/Admin';
import { isDeviceReadyEffective } from '@/lib/device-readiness';

type StartMotorRequestBody = {
  userId?: string;
  requestedMinutes?: number;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: StartMotorRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { userId, requestedMinutes } = body ?? {};

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (
      typeof requestedMinutes !== 'number' ||
      Number.isNaN(requestedMinutes) ||
      requestedMinutes <= 0
    ) {
      return NextResponse.json({ error: 'requestedMinutes must be > 0' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Authorization: users can start their own motor; admins/master can start within scope
    if (session.user.role === 'user' && session.user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.user.role === 'admin' && session.user.adminId !== String(user.adminId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json({ error: user.suspendReason || 'You are suspended' }, { status: 403 });
    }

    const admin = await Admin.findById(user.adminId)
      .select({ status: 1, suspendReason: 1, loadShedding: 1, deviceReady: 1, deviceLastSeenAt: 1 })
      .lean();
    if (admin && admin.status === 'suspended') {
      return NextResponse.json({ error: admin.suspendReason || 'You are suspended by admin/master' }, { status: 403 });
    }
    if (admin?.loadShedding) {
      return NextResponse.json({ error: 'Load shedding active now' }, { status: 403 });
    }
    if (!isDeviceReadyEffective(admin)) {
      return NextResponse.json({ error: 'Your device is not ready' }, { status: 403 });
    }

    if (user.availableMinutes < requestedMinutes) {
      return NextResponse.json({ error: 'Insufficient minutes' }, { status: 400 });
    }

    const busy = await isMotorBusy(user.adminId);
    await addToQueue(user.adminId, userId, requestedMinutes);

    const queuePosition = await getQueuePosition(user.adminId, userId);
    if (busy || queuePosition && queuePosition > 0) {
      return NextResponse.json({
        status: 'WAITING',
        queuePosition: queuePosition ?? undefined,
      });
    }

    return NextResponse.json({ status: 'RUNNING', queuePosition: 0 });
  } catch (error: any) {
    console.error('Motor start error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, details: typeof error === 'object' ? JSON.stringify(error) : undefined },
      { status: 500 },
    );
  }
}
