import mongoose, { Schema, Model, Types } from 'mongoose';

export type QueueStatus = 'WAITING' | 'RUNNING' | 'DONE';

export interface QueueDocument extends mongoose.Document {
  adminId: Types.ObjectId;
  userId: Types.ObjectId;
  position: number;
  status: QueueStatus;
  requestedMinutes: number;
  createdAt: Date;
}

const queueSchema = new Schema<QueueDocument>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    position: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['WAITING', 'RUNNING', 'DONE'],
      default: 'WAITING',
    },
    requestedMinutes: {
      type: Number,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'queues',
  },
);

// Ensure ordering and fast lookup per admin queue.
queueSchema.index({ adminId: 1, position: 1 }, { unique: false });

export const Queue: Model<QueueDocument> =
  mongoose.models.Queue || mongoose.model<QueueDocument>('Queue', queueSchema);

export default Queue;
