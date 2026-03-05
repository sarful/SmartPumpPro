import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { isDeviceOnline, isDeviceReadyEffective } from '@/lib/device-readiness';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const admin = await Admin.findById(session.user.adminId)
    .select({ loadShedding: 1, status: 1, username: 1, suspendReason: 1, deviceReady: 1, devicePinHigh: 1, deviceLastSeenAt: 1 })
    .lean();
  if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  const deviceOnline = isDeviceOnline(admin.deviceLastSeenAt);
  return NextResponse.json({
    admin: {
      ...admin,
      loadShedding: Boolean(admin.loadShedding) && deviceOnline,
      deviceOnline,
      deviceReady: isDeviceReadyEffective(admin),
    },
  });
}
