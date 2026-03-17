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

function computeFloorMinutes(activatedAt: Date | null | undefined, nowMs: number) {
  if (!activatedAt) return 0;
  const started = new Date(activatedAt).getTime();
  if (Number.isNaN(started)) return 0;
  const activeSeconds = Math.max(Math.floor((nowMs - started) / 1000), 0);
  return Math.floor(activeSeconds / 60);
}

function computeCeilMinutes(activatedAt: Date | null | undefined, nowMs: number) {
  if (!activatedAt) return 0;
  const started = new Date(activatedAt).getTime();
  if (Number.isNaN(started)) return 0;
  const activeSeconds = Math.max(Math.floor((nowMs - started) / 1000), 0);
  if (activeSeconds <= 0) return 0;
  return Math.ceil(activeSeconds / 60);
}

export async function billCardModeFloorMinutes(params: {
  adminId: string | Types.ObjectId;
  now?: Date;
}): Promise<{ billedDelta: number; availableMinutes?: number } | null> {
  await connectDB();
  const nowMs = (params.now ?? new Date()).getTime();
  const adminObjectId = toObjectId(params.adminId);

  const admin = await Admin.findById(adminObjectId)
    .select({ cardModeActive: 1, cardActiveUserId: 1, cardActivatedAt: 1, cardBilledMinutes: 1 })
    .lean();
  if (!admin?.cardModeActive || !admin.cardActiveUserId) return null;

  const shouldBeBilled = computeFloorMinutes(admin.cardActivatedAt, nowMs);
  const alreadyBilled = Math.max(Number(admin.cardBilledMinutes || 0), 0);
  const delta = Math.max(shouldBeBilled - alreadyBilled, 0);
  if (delta <= 0) return { billedDelta: 0 };

  const user = await User.findById(admin.cardActiveUserId).select({ availableMinutes: 1 }).lean();
  const current = user?.availableMinutes ?? 0;
  const next = Math.max(current - delta, 0);

  await Promise.all([
    User.updateOne(
      { _id: admin.cardActiveUserId },
      {
        $set: {
          availableMinutes: next,
          motorRunningTime: next,
        },
      },
    ).exec(),
    Admin.updateOne({ _id: adminObjectId }, { $set: { cardBilledMinutes: shouldBeBilled } }).exec(),
  ]);

  return { billedDelta: delta, availableMinutes: next };
}

export async function finalizeCardModeSession(params: {
  adminId: string | Types.ObjectId;
  reason: CardModeStopReason;
  now?: Date;
}): Promise<{ ended: boolean; usedMinutes: number; userId?: string }>{
  await connectDB();
  const nowMs = (params.now ?? new Date()).getTime();
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

  const alreadyBilled = Math.max(Number(admin.cardBilledMinutes || 0), 0);
  const shouldBeBilled =
    params.reason === 'removed' || params.reason === 'admin_override'
      ? computeCeilMinutes(admin.cardActivatedAt, nowMs)
      : computeFloorMinutes(admin.cardActivatedAt, nowMs);
  const delta = Math.max(shouldBeBilled - alreadyBilled, 0);

  if (admin.cardActiveUserId) {
    const user = await User.findById(admin.cardActiveUserId)
      .select({ availableMinutes: 1 })
      .lean();
    const current = user?.availableMinutes ?? 0;
    const next = Math.max(current - delta, 0);

    await User.updateOne(
      { _id: admin.cardActiveUserId },
      {
        $set: {
          availableMinutes: next,
          motorRunningTime: 0,
          lastSetMinutes: 0,
          motorStartTime: null,
          motorStatus: 'OFF',
        },
      },
    ).exec();
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
    usedMinutes: shouldBeBilled,
    userId: admin.cardActiveUserId ? String(admin.cardActiveUserId) : undefined,
  };
}
