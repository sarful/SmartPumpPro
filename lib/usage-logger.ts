import { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import UsageHistory, { UsageEvent } from '@/models/UsageHistory';

type LogParams = {
  adminId: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  event: UsageEvent;
  usedMinutes?: number;
  addedMinutes?: number;
  meta?: Record<string, any>;
};

export async function logEvent(params: LogParams) {
  await connectDB();
  await UsageHistory.create({
    adminId: params.adminId,
    userId: params.userId,
    event: params.event,
    usedMinutes: params.usedMinutes,
    addedMinutes: params.addedMinutes,
    meta: params.meta,
  });
}

export default logEvent;
