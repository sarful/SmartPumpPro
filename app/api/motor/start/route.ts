import { NextResponse, NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { addToQueue, getQueuePosition, isMotorBusy } from '@/lib/queue-engine';
import Admin from '@/models/Admin';
import { isDeviceReadyEffective } from '@/lib/device-readiness';
import { enforceRateLimit } from '@/lib/api-guard';
import { reportIncident } from '@/lib/observability';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';
import { MIN_RUNTIME_THRESHOLD } from '@/lib/timer-engine';

type StartMotorRequestBody = {
  userId?: string;
  requestedMinutes?: number;
};

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, 'motor-start', 30, 60_000);
    if (limited) return limited;

    const authResult = await requireWebMutationSession(['master', 'admin', 'user']);
    if (authResult.response) return authResult.response;
    const { session } = authResult;

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
    if (requestedMinutes <= MIN_RUNTIME_THRESHOLD) {
      return NextResponse.json(
        { error: `Requested minutes must be greater than ${MIN_RUNTIME_THRESHOLD}` },
        { status: 400 },
      );
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

    if ((user.availableMinutes ?? 0) < requestedMinutes) {
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
  } catch (error) {
    const requestId = await reportIncident({
      error,
      source: 'motor_start',
      route: '/api/motor/start',
      platform: 'web',
      ip: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    });
    return NextResponse.json({ error: 'Failed to start motor', requestId }, { status: 500 });
  }
}
