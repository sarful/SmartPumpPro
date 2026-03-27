import { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Queue, { QueueDocument } from '@/models/Queue';
import User from '@/models/User';
import { logEvent } from '@/lib/usage-logger';
import { MIN_RUNTIME_THRESHOLD } from '@/lib/timer-engine';

const toObjectId = (id: string | Types.ObjectId): Types.ObjectId =>
  typeof id === 'string' ? new Types.ObjectId(id) : id;

export async function isMotorBusy(adminId: string | Types.ObjectId): Promise<boolean> {
  await connectDB();
  const adminObjectId = toObjectId(adminId);
  const running = await Queue.findOne({ adminId: adminObjectId, status: 'RUNNING' }).lean();
  return Boolean(running);
}

export async function addToQueue(
  adminId: string | Types.ObjectId,
  userId: string | Types.ObjectId,
  requestedMinutes: number,
): Promise<QueueDocument> {
  await connectDB();
  const adminObjectId = toObjectId(adminId);
  const userObjectId = toObjectId(userId);

  if (requestedMinutes <= MIN_RUNTIME_THRESHOLD) {
    throw new Error(`requestedMinutes must be greater than ${MIN_RUNTIME_THRESHOLD}`);
  }

  // Prevent duplicate active entries for same user
  const existingActive = await Queue.findOne({
    adminId: adminObjectId,
    userId: userObjectId,
    status: { $in: ['RUNNING', 'WAITING'] },
  });
  if (existingActive) return existingActive;

  const currentMax = await Queue.findOne({ adminId: adminObjectId })
    .sort({ position: -1 })
    .select({ position: 1 })
    .lean();
  const nextPosition = (currentMax?.position ?? 0) + 1;

  const busy = await Queue.exists({ adminId: adminObjectId, status: 'RUNNING' });

  const status = busy ? 'WAITING' : 'RUNNING';

  const queueEntry = await Queue.create({
    adminId: adminObjectId,
    userId: userObjectId,
    position: nextPosition,
    status,
    requestedMinutes,
  });

  if (status === 'RUNNING') {
    await User.findByIdAndUpdate(
      userObjectId,
      {
        $inc: { availableMinutes: -requestedMinutes },
        $set: {
          motorStatus: 'RUNNING',
          motorStartTime: new Date(),
          lastSetMinutes: requestedMinutes,
          motorRunningTime: requestedMinutes,
        },
      },
      { runValidators: true },
    ).exec();
    await logEvent({
      adminId: adminObjectId,
      userId: userObjectId,
      event: 'motor_start',
      meta: { requestedMinutes },
    });
  }

  return queueEntry;
}

export async function startNextUser(
  adminId: string | Types.ObjectId,
): Promise<QueueDocument | null> {
  await connectDB();
  const adminObjectId = toObjectId(adminId);

  const running = await Queue.findOne({ adminId: adminObjectId, status: 'RUNNING' });
  if (running) return running;

  const next = await Queue.findOneAndUpdate(
    { adminId: adminObjectId, status: 'WAITING' },
    { status: 'RUNNING' },
    { sort: { position: 1 }, returnDocument: 'after' },
  );

  if (next) {
    await User.findByIdAndUpdate(
      next.userId,
      {
        $inc: { availableMinutes: -next.requestedMinutes },
        $set: {
          motorStatus: 'RUNNING',
          motorStartTime: new Date(),
          lastSetMinutes: next.requestedMinutes,
          motorRunningTime: next.requestedMinutes,
        },
      },
      { runValidators: true },
    ).exec();
    await logEvent({
      adminId: adminObjectId,
      userId: next.userId,
      event: 'motor_start',
      meta: { requestedMinutes: next.requestedMinutes },
    });
  }

  return next;
}

export async function getQueuePosition(
  adminId: string | Types.ObjectId,
  userId: string | Types.ObjectId,
): Promise<number | null> {
  await connectDB();
  const adminObjectId = toObjectId(adminId);
  const userObjectId = toObjectId(userId);

  const entry = await Queue.findOne({
    adminId: adminObjectId,
    userId: userObjectId,
    status: { $in: ['WAITING', 'RUNNING'] },
  }).lean();

  if (!entry) return null;
  if (entry.status === 'RUNNING') return 0;

  const ahead = await Queue.countDocuments({
    adminId: adminObjectId,
    status: 'WAITING',
    position: { $lt: entry.position },
  });

  return ahead + 1;
}
