import { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import User, { UserDocument } from '@/models/User';
import Queue from '@/models/Queue';
import { startNextUser } from '@/lib/queue-engine';
import Admin from '@/models/Admin';
import { billCardModeFloorMinutes, finalizeCardModeSession, getAdminCardMode } from '@/lib/card-mode';

const toObjectId = (id: string | Types.ObjectId): Types.ObjectId =>
  typeof id === 'string' ? new Types.ObjectId(id) : id;

export function calculateUsedMinutes(startTime: Date | null, setMinutes: number): number {
  if (!startTime || !setMinutes || setMinutes <= 0) return 0;
  const elapsedMs = Date.now() - new Date(startTime).getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  return Math.min(Math.max(elapsedMinutes, 0), Math.max(setMinutes, 0));
}

export async function tickRunningMotors(): Promise<void> {
  await connectDB();
  const now = Date.now();
  const runningUsers = await User.find({ motorStatus: 'RUNNING' }).lean();

  for (const user of runningUsers) {
    if (!user.motorStartTime) continue;

    // If the admin is under load shedding or card mode, skip decrementing (card mode is billed separately)
    const admin = await Admin.findById(user.adminId).select({ loadShedding: 1, cardModeActive: 1, cardActiveUserId: 1 }).lean();
    if (admin?.loadShedding) continue;
    if (admin?.cardModeActive) continue;

    const elapsedMinutesTotal = Math.floor((now - new Date(user.motorStartTime).getTime()) / 60000);
    if (elapsedMinutesTotal <= 0) continue;

    const remainingBefore = user.motorRunningTime ?? 0;
    const lastSet = user.lastSetMinutes ?? 0;
    const usedAlready = Math.max(lastSet - remainingBefore, 0);
    const delta = Math.max(elapsedMinutesTotal - usedAlready, 0);
    if (delta <= 0) continue;

    const decrement = Math.min(delta, remainingBefore);
    const remainingAfter = Math.max(remainingBefore - decrement, 0);

    await User.findByIdAndUpdate(user._id, {
      $set: {
        motorRunningTime: remainingAfter,
        motorStatus: remainingAfter > 0 ? 'RUNNING' : 'OFF',
        motorStartTime: remainingAfter > 0 ? user.motorStartTime : null,
      },
    }).exec();

    if (remainingAfter === 0) {
      await Queue.findOneAndUpdate(
        { adminId: user.adminId, userId: user._id, status: 'RUNNING' },
        { status: 'DONE' },
      ).exec();
      await startNextUser(user.adminId);
      const { logEvent } = await import('@/lib/usage-logger');
      await logEvent({
        adminId: user.adminId,
        userId: user._id,
        event: 'motor_stop',
        usedMinutes: user.lastSetMinutes - remainingBefore + decrement,
      });
    }
  }
}

export async function tickCardModeBilling(): Promise<void> {
  await connectDB();
  const admins = await Admin.find({ cardModeActive: true }).select({ _id: 1 }).lean();
  for (const admin of admins) {
    await billCardModeFloorMinutes({ adminId: admin._id });
    const meta = await getAdminCardMode(admin._id);
    if (!meta?.cardModeActive || !meta.cardActiveUserId) continue;
    const cardUser = await User.findById(meta.cardActiveUserId).select({ availableMinutes: 1 }).lean();
    if ((cardUser?.availableMinutes ?? 0) <= 5) {
      await finalizeCardModeSession({ adminId: admin._id, reason: 'insufficient' });
    }
  }
}

export async function stopMotorForUser(
  userId: string | Types.ObjectId,
): Promise<UserDocument | null> {
  await connectDB();
  const userObjectId = toObjectId(userId);
  const user = await User.findById(userObjectId);
  if (!user || (user.motorStatus !== 'RUNNING' && user.motorStatus !== 'HOLD')) return null;

  const admin = await Admin.findById(user.adminId).select({ cardModeActive: 1, cardActiveUserId: 1 }).lean();
  if (admin?.cardModeActive && String(admin.cardActiveUserId ?? '') === String(user._id)) {
    const { finalizeCardModeSession } = await import('@/lib/card-mode');
    await finalizeCardModeSession({ adminId: user.adminId, reason: 'admin_override' });
    return await User.findById(userObjectId);
  }

  const usedMinutes = calculateUsedMinutes(user.motorStartTime, user.lastSetMinutes);
  const remaining =
    user.motorRunningTime && user.motorRunningTime > 0
      ? user.motorRunningTime
      : Math.max(user.lastSetMinutes - usedMinutes, 0);

  // Refund unused portion immediately
  const refund = Math.max(remaining, 0);
  user.availableMinutes = Math.max((user.availableMinutes ?? 0) + refund, 0);

  user.motorRunningTime = 0;
  user.motorStatus = 'OFF';
  user.motorStartTime = null;
  await user.save();

  const { logEvent } = await import('@/lib/usage-logger');
  await logEvent({
    adminId: user.adminId,
    userId: user._id,
    event: 'motor_stop',
    usedMinutes,
  });

  await Queue.findOneAndUpdate(
    { adminId: user.adminId, userId: user._id, status: { $in: ['RUNNING', 'WAITING'] } },
    { status: 'DONE' },
  ).exec();

  await startNextUser(user.adminId);

  return user;
}
