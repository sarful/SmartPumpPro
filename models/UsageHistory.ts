import mongoose, { Schema, Model, Types } from 'mongoose';

export type UsageEvent =
  | 'motor_start'
  | 'motor_stop'
  | 'recharge'
  | 'attendance'
  | 'hold'
  | 'resume';

export interface UsageHistoryDocument extends mongoose.Document {
  userId: Types.ObjectId;
  adminId: Types.ObjectId;
  usedMinutes?: number;
  addedMinutes?: number;
  event: UsageEvent;
  date: Date;
  meta?: Record<string, any>;
}

const usageHistorySchema = new Schema<UsageHistoryDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    usedMinutes: { type: Number },
    addedMinutes: { type: Number },
    event: { type: String, enum: ['motor_start', 'motor_stop', 'recharge', 'attendance', 'hold', 'resume'], required: true },
    date: { type: Date, default: Date.now, index: true },
    meta: { type: Schema.Types.Mixed },
  },
  { collection: 'usage_history' },
);

usageHistorySchema.index({ adminId: 1, date: -1 });
usageHistorySchema.index({ userId: 1, date: -1 });

export const UsageHistory: Model<UsageHistoryDocument> =
  mongoose.models.UsageHistory || mongoose.model<UsageHistoryDocument>('UsageHistory', usageHistorySchema);

export default UsageHistory;
