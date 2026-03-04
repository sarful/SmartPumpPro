import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getQueuePosition } from '@/lib/queue-engine';
import Admin from '@/models/Admin';
import { isDeviceReadyEffective } from '@/lib/device-readiness';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'user') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await User.findById(session.user.id)
      .select({ username: 1, adminId: 1, availableMinutes: 1, status: 1, suspendReason: 1 })
      .lean();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const admin = await Admin.findById(user.adminId)
      .select({ username: 1, status: 1, suspendReason: 1, loadShedding: 1, deviceReady: 1, deviceLastSeenAt: 1 })
      .lean();

    const queuePosition = await getQueuePosition(user.adminId, user._id);

    return NextResponse.json({
      username: user.username,
      adminId: user.adminId,
      adminName: admin?.username ?? null,
      adminStatus: admin?.status ?? 'active',
      adminReason: admin?.suspendReason ?? null,
      loadShedding: Boolean(admin?.loadShedding),
      deviceReady: admin ? isDeviceReadyEffective(admin) : null,
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
