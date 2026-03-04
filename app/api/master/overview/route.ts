import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import User from '@/models/User';
import Queue from '@/models/Queue';
import { isDeviceOnline, isDeviceReadyEffective } from '@/lib/device-readiness';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const [adminCount, userCount, running, waiting, adminList, userList] = await Promise.all([
    Admin.countDocuments({}),
    User.countDocuments({}),
    Queue.countDocuments({ status: 'RUNNING' }),
    Queue.countDocuments({ status: 'WAITING' }),
    Admin.find({})
      .select({ username: 1, status: 1, loadShedding: 1, suspendReason: 1, deviceReady: 1, devicePinHigh: 1, deviceLastSeenAt: 1 })
      .lean(),
    User.find({})
      .select({
        username: 1,
        adminId: 1,
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
    deviceOnline: isDeviceOnline(a.deviceLastSeenAt),
    deviceReady: isDeviceReadyEffective(a),
  }));

  const adminNameMap = Object.fromEntries(adminsWithDeviceState.map((a: any) => [String(a._id), a.username]));
  const usersWithAdminName = userList.map((u: any) => ({
    ...u,
    adminName: adminNameMap[String(u.adminId)] ?? u.adminId,
  }));

  return NextResponse.json({
    adminCount,
    userCount,
    running,
    waiting,
    admins: adminsWithDeviceState,
    users: usersWithAdminName,
  });
}
