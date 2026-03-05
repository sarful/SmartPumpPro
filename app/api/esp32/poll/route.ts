import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Admin from '@/models/Admin';
import Queue from '@/models/Queue';
import { getQueuePosition } from '@/lib/queue-engine';
import { tickRunningMotors } from '@/lib/timer-engine';
import { activateLoadShedding, clearLoadShedding } from '@/lib/loadshedding-engine';
import { isDeviceOnline, isDeviceReadyEffective } from '@/lib/device-readiness';
import { logReadinessTransitions } from '@/lib/usage-logger';

const BAD_REQUEST = { error: 'adminId is required' };

type AdminSnapshot = {
  loadShedding?: boolean;
  username?: string;
  status?: 'pending' | 'active' | 'suspended';
  suspendReason?: string | null;
  deviceReady?: boolean;
  devicePinHigh?: boolean;
  deviceLastSeenAt?: Date | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const adminId = searchParams.get('adminId');
  const userId = searchParams.get('userId');
  const lsParam = searchParams.get('ls'); // optional: ESP32 sensed load-shedding (true/1)
  const devParam = searchParams.get('dev') ?? searchParams.get('device'); // optional: ESP32 device-ready pin (true/1)

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
      ? await Admin.findById(adminLookupId)
          .select({
            loadShedding: 1,
            username: 1,
            status: 1,
            suspendReason: 1,
            deviceReady: 1,
            devicePinHigh: 1,
            deviceLastSeenAt: 1,
          })
          .lean()
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

    if (adminLookupId && devParam !== null) {
      const devicePinHigh = ['1', 'true', 'on', 'yes', 'high'].includes(devParam.toLowerCase());
      admin = await Admin.findByIdAndUpdate(
        adminLookupId,
        {
          $set: {
            deviceReady: devicePinHigh,
            devicePinHigh,
            deviceLastSeenAt: new Date(),
          },
        },
        {
          new: true,
          projection: {
            loadShedding: 1,
            username: 1,
            status: 1,
            suspendReason: 1,
            deviceReady: 1,
            devicePinHigh: 1,
            deviceLastSeenAt: 1,
          },
        },
      ).lean();
    }

    // Gate motor by load shedding + device readiness + suspend status.
    const deviceOnline = isDeviceOnline(admin?.deviceLastSeenAt ?? null);
    const effectiveDeviceReady = isDeviceReadyEffective(admin);
    const effectiveLoadShedding = Boolean(admin?.loadShedding) && deviceOnline;
    const adminBlocked =
      effectiveLoadShedding ||
      !effectiveDeviceReady ||
      admin?.status === 'suspended';

    const runningQueue = await Queue.findOne({ adminId: adminLookupId, status: 'RUNNING' })
      .select({ userId: 1 })
      .lean();

    if (runningQueue?.userId) {
      const runningUser = await User.findById(runningQueue.userId)
        .select({ status: 1, motorStatus: 1, motorRunningTime: 1 })
        .lean();

      const runningUserBlocked = runningUser?.status === 'suspended';
      const shouldHold = adminBlocked || runningUserBlocked;

      if (shouldHold && runningUser?.motorStatus === 'RUNNING') {
        await User.updateOne(
          { _id: runningQueue.userId },
          { $set: { motorStatus: 'HOLD', motorStartTime: null } },
        );
      } else if (!shouldHold && runningUser?.motorStatus === 'HOLD') {
        await User.updateOne(
          { _id: runningQueue.userId },
          {
            $set: {
              motorStatus: 'RUNNING',
              motorStartTime: new Date(),
              lastSetMinutes: runningUser.motorRunningTime ?? 0,
            },
          },
        );
      }
    }

    const freshUser = await User.findById(user._id)
      .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1, status: 1 })
      .lean();

    if (!freshUser) {
      return NextResponse.json({ error: 'User not found after state update' }, { status: 404 });
    }

    const runningUserDoc = await User.findOne({
      adminId: freshUser.adminId,
      motorStatus: 'RUNNING',
    })
      .select({ username: 1, status: 1 })
      .lean();

    const userBlocked = freshUser.status === 'suspended';
    const holdReason = effectiveLoadShedding
      ? 'loadshedding'
      : !effectiveDeviceReady
        ? 'device_not_ready'
        : admin?.status === 'suspended'
          ? 'admin_suspended'
          : userBlocked
            ? 'user_suspended'
            : null;

    await logReadinessTransitions({
      adminId: freshUser.adminId.toString(),
      userId: freshUser._id.toString(),
      current: {
        deviceReady: effectiveDeviceReady,
        loadShedding: effectiveLoadShedding,
        internetOnline: effectiveDeviceReady,
      },
      meta: {
        source: 'esp32_poll',
      },
    });

    return NextResponse.json({
      userId: freshUser._id,
      motorStatus: freshUser.motorStatus,
      remainingMinutes: freshUser.motorRunningTime ?? 0,
      availableMinutes: freshUser.availableMinutes ?? 0,
      loadShedding: effectiveLoadShedding,
      deviceReady: effectiveDeviceReady,
      devicePinHigh: admin?.devicePinHigh ?? false,
      adminStatus: admin?.status ?? 'active',
      userStatus: freshUser.status ?? 'active',
      holdReason,
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
