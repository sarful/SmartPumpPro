import { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import UsageHistory, { UsageEvent } from '@/models/UsageHistory';
import User from '@/models/User';

type LogParams = {
  adminId: string | Types.ObjectId;
  userId?: string | Types.ObjectId;
  event: UsageEvent;
  usedMinutes?: number;
  addedMinutes?: number;
  currentBalance?: number;
  meta?: Record<string, unknown>;
};

async function resolveUserId(
  adminId: string | Types.ObjectId,
  userId?: string | Types.ObjectId,
): Promise<string | Types.ObjectId | null> {
  if (userId) return userId;
  const fallback = await User.findOne({ adminId }).select({ _id: 1 }).lean();
  return fallback?._id ? String(fallback._id) : null;
}

export async function logEvent(params: LogParams) {
  await connectDB();
  const resolvedUserId = await resolveUserId(params.adminId, params.userId);
  if (!resolvedUserId) return;
  let currentBalance = params.currentBalance;
  if (typeof currentBalance !== 'number') {
    const user = await User.findById(resolvedUserId).select({ availableMinutes: 1 }).lean();
    currentBalance = user?.availableMinutes;
  }
  await UsageHistory.create({
    adminId: params.adminId,
    userId: resolvedUserId,
    event: params.event,
    usedMinutes: params.usedMinutes,
    addedMinutes: params.addedMinutes,
    currentBalance,
    meta: params.meta,
  });
}

type ReadinessSnapshot = {
  deviceReady: boolean;
  loadShedding: boolean;
  internetOnline: boolean;
};

const TRANSITIONS: Array<{ key: keyof ReadinessSnapshot; on: UsageEvent; off: UsageEvent }> = [
  { key: 'deviceReady', on: 'system_device_ready', off: 'system_device_not_ready' },
  { key: 'loadShedding', on: 'system_loadshedding_on', off: 'system_loadshedding_off' },
  { key: 'internetOnline', on: 'system_internet_online', off: 'system_internet_offline' },
];

export async function logReadinessTransitions(params: {
  adminId: string | Types.ObjectId;
  userId?: string | Types.ObjectId;
  current: ReadinessSnapshot;
  meta?: Record<string, unknown>;
}) {
  await connectDB();
  const resolvedUserId = await resolveUserId(params.adminId, params.userId);
  if (!resolvedUserId) return;
  const user = await User.findById(resolvedUserId).select({ availableMinutes: 1 }).lean();
  const currentBalance = user?.availableMinutes;

  for (const t of TRANSITIONS) {
    const desiredEvent = params.current[t.key] ? t.on : t.off;
    const last = await UsageHistory.findOne({
      adminId: params.adminId,
      event: { $in: [t.on, t.off] },
    })
      .sort({ date: -1 })
      .select({ event: 1 })
      .lean();

    if (last?.event === desiredEvent) continue;

    await UsageHistory.create({
      adminId: params.adminId,
      userId: resolvedUserId,
      event: desiredEvent,
      currentBalance,
      meta: {
        ...(params.meta || {}),
        systemReadiness: {
          systemDeviceReady: params.current.deviceReady,
          systemLoadShedding: params.current.loadShedding,
          systemInternet: params.current.internetOnline,
        },
      },
    });
  }
}

export default logEvent;
