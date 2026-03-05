import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getQueuePosition } from '@/lib/queue-engine';
import Admin from '@/models/Admin';
import { isDeviceOnline, isDeviceReadyEffective } from '@/lib/device-readiness';
import { logReadinessTransitions } from '@/lib/usage-logger';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'user') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const userById = await User.findById(session.user.id)
      .select({ username: 1, adminId: 1, availableMinutes: 1, status: 1, suspendReason: 1, createdAt: 1 })
      .lean();

    // Canonical user selection:
    // 1) prefer latest record by username+tenant (handles recreated users with stale session id)
    // 2) fallback to latest username globally
    // 3) fallback to id-based user
    const userByTenantUsername =
      session.user.username && session.user.adminId
        ? await User.findOne({
            username: session.user.username,
            adminId: session.user.adminId,
          })
            .sort({ createdAt: -1 })
            .select({ username: 1, adminId: 1, availableMinutes: 1, status: 1, suspendReason: 1, createdAt: 1 })
            .lean()
        : null;

    const userByUsername =
      session.user.username && !userByTenantUsername
        ? await User.findOne({ username: session.user.username })
            .sort({ createdAt: -1 })
            .select({ username: 1, adminId: 1, availableMinutes: 1, status: 1, suspendReason: 1, createdAt: 1 })
            .lean()
        : null;

    const user = userByTenantUsername || userByUsername || userById;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const admin = await Admin.findById(user.adminId)
      .select({ username: 1, status: 1, suspendReason: 1, loadShedding: 1, deviceReady: 1, deviceLastSeenAt: 1 })
      .lean();

    const queuePosition = await getQueuePosition(user.adminId, user._id);

    const deviceOnline = isDeviceOnline(admin?.deviceLastSeenAt ?? null);
    const effectiveDeviceReady = admin ? isDeviceReadyEffective(admin) : false;
    const effectiveLoadShedding = Boolean(admin?.loadShedding) && deviceOnline;

    await logReadinessTransitions({
      adminId: user.adminId,
      userId: user._id,
      current: {
        deviceReady: effectiveDeviceReady,
        loadShedding: effectiveLoadShedding,
        internetOnline: effectiveDeviceReady,
      },
      meta: { source: 'user_me' },
    });

    return NextResponse.json({
      userId: user._id,
      username: user.username,
      adminId: user.adminId,
      adminName: admin?.username ?? null,
      adminStatus: admin?.status ?? 'active',
      adminReason: admin?.suspendReason ?? null,
      loadShedding: effectiveLoadShedding,
      deviceReady: admin ? effectiveDeviceReady : null,
      status: user.status ?? 'active',
      suspendReason: user.suspendReason ?? null,
      availableMinutes: user.availableMinutes ?? 0,
      queuePosition,
    });
  } catch (error: any) {
    console.error('User me error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, details: String(error) }, { status: 500 });
  }
}
