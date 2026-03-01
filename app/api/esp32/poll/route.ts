import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Admin from '@/models/Admin';
import { getQueuePosition } from '@/lib/queue-engine';
import { tickRunningMotors } from '@/lib/timer-engine';

const BAD_REQUEST = { error: 'adminId is required' };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const adminId = searchParams.get('adminId');
  const userId = searchParams.get('userId');
  const lsParam = searchParams.get('ls'); // optional: ESP32 sensed load-shedding (true/1)

  try {
    await connectDB();
    // Run one tick to decrement timers and auto-stop if needed
    await tickRunningMotors();

    if (!adminId) {
      return NextResponse.json(BAD_REQUEST, { status: 400 });
    }

    // If ESP32 sends local load-shedding reading, persist it on admin
    if (lsParam !== null) {
      const sensed = ['1', 'true', 'on', 'yes'].includes(lsParam.toLowerCase());
      await Admin.updateOne({ _id: adminId }, { loadShedding: sensed }).lean();
    }

    // If userId missing, derive by admin: pick RUNNING if any, else top of queue user if present.
    let user =
      userId &&
      (await User.findById(userId)
        .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1 })
        .lean());

    if (!user) {
      user =
        (await User.findOne({ adminId, motorStatus: 'RUNNING' })
          .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1 })
          .lean()) ||
        (await User.findOne({ adminId })
          .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1 })
          .lean());
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found for admin' }, { status: 404 });
    }

    const adminLookupId = adminId ?? user.adminId?.toString();
    const admin = adminLookupId
      ? await Admin.findById(adminLookupId).select({ loadShedding: 1, username: 1 }).lean()
      : null;

    // If admin missing, still return user state (avoid failing ESP32 polling)

    return NextResponse.json({
      motorStatus: user.motorStatus,
      remainingMinutes: user.motorRunningTime ?? 0,
      loadShedding: admin?.loadShedding ?? false,
      adminName: admin?.username ?? null,
      queuePosition: await getQueuePosition(user.adminId.toString(), user._id.toString()),
      runningUser: user.motorStatus === 'RUNNING' ? user.username : undefined,
      estimatedWait: await estimateWait(user.adminId.toString(), user._id.toString()),
    });
  } catch (error) {
    console.error('ESP32 poll error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function estimateWait(adminId: string, userId: string) {
  // naive estimate: if user running, remainingMinutes; if waiting, sum of ahead RUNNING remaining
  const running = await User.findOne({ adminId, motorStatus: 'RUNNING' })
    .select({ motorRunningTime: 1, _id: 1 })
    .lean();
  if (!running) return 0;
  if (String(running._id) === String(userId)) return running.motorRunningTime ?? 0;
  return running.motorRunningTime ?? 0;
}
