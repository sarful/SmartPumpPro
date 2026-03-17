import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { isDeviceOnline, isDeviceReadyEffective } from '@/lib/device-readiness';
import { logReadinessTransitions } from '@/lib/usage-logger';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const admin = await Admin.findById(session.user.adminId)
    .select({
      loadShedding: 1,
      status: 1,
      username: 1,
      suspendReason: 1,
      deviceReady: 1,
      devicePinHigh: 1,
      deviceLastSeenAt: 1,
      cardModeActive: 1,
      cardActiveUserId: 1,
      cardModeMessage: 1,
    })
    .lean();
  if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  const deviceOnline = isDeviceOnline(admin.deviceLastSeenAt);
  const effectiveDeviceReady = isDeviceReadyEffective(admin);
  const effectiveLoadShedding = Boolean(admin.loadShedding) && deviceOnline;
  await logReadinessTransitions({
    adminId: session.user.adminId!,
    current: {
      deviceReady: effectiveDeviceReady,
      loadShedding: effectiveLoadShedding,
      internetOnline: effectiveDeviceReady,
    },
    meta: { source: 'admin_status' },
  });
  return NextResponse.json({
    admin: {
      ...admin,
      cardActiveUserId: admin.cardActiveUserId ? String(admin.cardActiveUserId) : null,
      loadShedding: effectiveLoadShedding,
      deviceOnline,
      deviceReady: effectiveDeviceReady,
    },
  });
}
