import { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import User from '@/models/User';

export type CardModeStopReason = 'removed' | 'insufficient' | 'admin_override' | 'unknown_uid';

export function normalizeRfidUid(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

const toObjectId = (id: string | Types.ObjectId): Types.ObjectId =>
  typeof id === 'string' ? new Types.ObjectId(id) : id;

export async function getAdminCardMode(adminId: string | Types.ObjectId) {
  await connectDB();
  const adminObjectId = toObjectId(adminId);
  return Admin.findById(adminObjectId)
    .select({
      cardModeActive: 1,
      cardActiveUid: 1,
      cardActiveUserId: 1,
      cardActivatedAt: 1,
      cardLastSeenAt: 1,
      cardBilledMinutes: 1,
      cardModeMessage: 1,
      cardModeStopReason: 1,
    })
    .lean();
}

export async function billCardModeFloorMinutes(params: {
  adminId: string | Types.ObjectId;
  now?: Date;
}): Promise<{ billedDelta: number; availableMinutes?: number } | null> {
  await connectDB();
  const adminObjectId = toObjectId(params.adminId);

  const admin = await Admin.findById(adminObjectId)
    .select({ cardModeActive: 1, cardActiveUserId: 1, cardActivatedAt: 1, cardBilledMinutes: 1 })
    .lean();
  if (!admin?.cardModeActive || !admin.cardActiveUserId) return null;

  const user = await User.findById(admin.cardActiveUserId).select({ availableMinutes: 1 }).lean();
  return { billedDelta: 0, availableMinutes: user?.availableMinutes ?? 0 };
}

export async function finalizeCardModeSession(params: {
  adminId: string | Types.ObjectId;
  reason: CardModeStopReason;
  now?: Date;
}): Promise<{ ended: boolean; usedMinutes: number; userId?: string }>{
  await connectDB();
  const adminObjectId = toObjectId(params.adminId);

  const admin = await Admin.findById(adminObjectId)
    .select({
      cardModeActive: 1,
      cardActiveUserId: 1,
      cardActivatedAt: 1,
      cardBilledMinutes: 1,
    })
    .lean();

  if (!admin?.cardModeActive) return { ended: false, usedMinutes: 0 };

  if (admin.cardActiveUserId) {
    const user = await User.findById(admin.cardActiveUserId)
      .select({ availableMinutes: 1, lastSetMinutes: 1, motorRunningTime: 1 })
      .lean();
    const remaining = Math.max(user?.availableMinutes ?? user?.motorRunningTime ?? 0, 0);
    const initial = Math.max(user?.lastSetMinutes ?? remaining, 0);
    const usedMinutes = Math.max(initial - remaining, 0);

    await User.updateOne(
      { _id: admin.cardActiveUserId },
      {
        $set: {
          availableMinutes: remaining,
          motorRunningTime: 0,
          lastSetMinutes: 0,
          motorStartTime: null,
          motorStatus: 'OFF',
        },
      },
    ).exec();

    await Admin.updateOne(
      { _id: adminObjectId },
      {
        $set: {
          cardModeActive: false,
          cardActiveUid: null,
          cardActiveUserId: null,
          cardActivatedAt: null,
          cardLastSeenAt: null,
          cardBilledMinutes: 0,
          cardModeMessage: null,
          cardModeStopReason: params.reason,
        },
      },
    ).exec();

    return {
      ended: true,
      usedMinutes,
      userId: String(admin.cardActiveUserId),
    };
  }

  await Admin.updateOne(
    { _id: adminObjectId },
    {
      $set: {
        cardModeActive: false,
        cardActiveUid: null,
        cardActiveUserId: null,
        cardActivatedAt: null,
        cardLastSeenAt: null,
        cardBilledMinutes: 0,
        cardModeMessage: null,
        cardModeStopReason: params.reason,
      },
    },
  ).exec();

  return {
    ended: true,
    usedMinutes: 0,
    userId: admin.cardActiveUserId ? String(admin.cardActiveUserId) : undefined,
  };
}
