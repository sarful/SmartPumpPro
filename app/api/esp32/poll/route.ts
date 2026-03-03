import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Admin from '@/models/Admin';
import Queue from '@/models/Queue';
import { getQueuePosition } from '@/lib/queue-engine';
import { tickRunningMotors } from '@/lib/timer-engine';
import { activateLoadShedding, clearLoadShedding } from '@/lib/loadshedding-engine';

const BAD_REQUEST = { error: 'adminId is required' };

type AdminSnapshot = {
  loadShedding?: boolean;
  username?: string;
};

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

    const adminLookupId = (adminId ?? user.adminId?.toString()) || null;
    let admin: AdminSnapshot | null = adminLookupId
      ? await Admin.findById(adminLookupId).select({ loadShedding: 1, username: 1 }).lean()
      : null;

    // React to ESP32 sensed load shedding: pause/resume motors
    if (adminLookupId && lsParam !== null) {
      const sensed = ['1', 'true', 'on', 'yes'].includes(lsParam.toLowerCase());
      const current = admin?.loadShedding ?? false;
      if (sensed !== current) {
        if (sensed) {
          await activateLoadShedding(adminLookupId);
        } else {
          await clearLoadShedding(adminLookupId);
        }
        admin = { ...(admin || {}), loadShedding: sensed, username: admin?.username };
      }
    }

    const freshUser = await User.findById(user._id)
      .select({ motorStatus: 1, motorRunningTime: 1, adminId: 1, username: 1 })
      .lean();

    if (!freshUser) {
      return NextResponse.json({ error: 'User not found after state update' }, { status: 404 });
    }

    const runningUserDoc = await User.findOne({
      adminId: freshUser.adminId,
      motorStatus: 'RUNNING',
    })
      .select({ username: 1 })
      .lean();

    return NextResponse.json({
      motorStatus: freshUser.motorStatus,
      remainingMinutes: freshUser.motorRunningTime ?? 0,
      loadShedding: admin?.loadShedding ?? false,
      adminName: admin?.username ?? null,
      queuePosition: await getQueuePosition(freshUser.adminId.toString(), freshUser._id.toString()),
      runningUser: runningUserDoc?.username ?? null,
      estimatedWait: await estimateWait(freshUser.adminId.toString(), freshUser._id.toString()),
    });
  } catch (error) {
    console.error('ESP32 poll error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function estimateWait(adminId: string, userId: string) {
  const entry = await Queue.findOne({
    adminId,
    userId,
    status: { $in: ['WAITING', 'RUNNING'] },
  })
    .select({ position: 1, status: 1 })
    .lean();
  if (!entry) return 0;
  if (entry.status === 'RUNNING') return 0;

  const runningQueue = await Queue.findOne({ adminId, status: 'RUNNING' })
    .select({ userId: 1, requestedMinutes: 1 })
    .lean();

  let wait = 0;
  if (runningQueue?.userId) {
    const runningUser = await User.findById(runningQueue.userId)
      .select({ motorRunningTime: 1 })
      .lean();
    wait += runningUser?.motorRunningTime ?? runningQueue.requestedMinutes ?? 0;
  }

  const waitingAhead = await Queue.find({
    adminId,
    status: 'WAITING',
    position: { $lt: entry.position },
  })
    .select({ requestedMinutes: 1 })
    .lean();

  wait += waitingAhead.reduce((sum, item) => sum + (item.requestedMinutes ?? 0), 0);
  return wait;
}
