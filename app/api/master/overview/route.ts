import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import User from '@/models/User';
import Queue from '@/models/Queue';
import { isDeviceOnline, isDeviceReadyEffective } from '@/lib/device-readiness';
import { enforceRateLimit } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, 'master-overview', 30, 60_000);
  if (limited) return limited;

  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const [adminCount, userCount, runningQueueCount, waiting, adminList, userList] = await Promise.all([
    Admin.countDocuments({}),
    User.countDocuments({}),
    Queue.countDocuments({ status: 'RUNNING' }),
    Queue.countDocuments({ status: 'WAITING' }),
    Admin.find({})
      .select({
        username: 1,
        status: 1,
        loadShedding: 1,
        suspendReason: 1,
        deviceReady: 1,
        devicePinHigh: 1,
        deviceLastSeenAt: 1,
        cardModeActive: 1,
        cardActiveUserId: 1,
      })
      .lean(),
    User.find({})
      .select({
        username: 1,
        adminId: 1,
        rfidUid: 1,
        status: 1,
        suspendReason: 1,
        availableMinutes: 1,
        motorStatus: 1,
        motorRunningTime: 1,
      })
      .lean(),
  ]);

   // map adminId -> name for user records
  const adminsWithDeviceState = adminList.map((a: any) => ({
    ...a,
    loadShedding: Boolean(a.loadShedding) && isDeviceOnline(a.deviceLastSeenAt),
    deviceOnline: isDeviceOnline(a.deviceLastSeenAt),
    deviceReady: isDeviceReadyEffective(a),
  }));

  const cardRunningCount = adminsWithDeviceState.filter((a: any) => Boolean(a.cardModeActive)).length;
  const running = runningQueueCount + cardRunningCount;

  const adminMetaMap = Object.fromEntries(
    adminsWithDeviceState.map((a: any) => [
      String(a._id),
      {
        name: a.username,
        cardModeActive: Boolean(a.cardModeActive),
        cardActiveUserId: a.cardActiveUserId ? String(a.cardActiveUserId) : null,
      },
    ]),
  );
  const usersWithAdminName = userList.map((u: any) => {
    const meta = adminMetaMap[String(u.adminId)];
    const useSource = meta?.cardModeActive && meta.cardActiveUserId === String(u._id)
      ? 'Card'
      : u.motorStatus === 'RUNNING'
        ? 'Web'
        : '-';
    return {
      ...u,
      adminName: meta?.name ?? u.adminId,
      useSource,
    };
  });

  return NextResponse.json({
    adminCount,
    userCount,
    running,
    waiting,
    admins: adminsWithDeviceState,
    users: usersWithAdminName,
  });
}
