import mongoose, { Schema, Model, Types } from 'mongoose';

export type MinuteRequestStatus = 'pending' | 'approved' | 'declined';

export interface MinuteRequestDocument extends mongoose.Document {
  userId: Types.ObjectId;
  adminId: Types.ObjectId;
  minutes: number;
  status: MinuteRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const minuteRequestSchema = new Schema<MinuteRequestDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    minutes: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
  },
  { timestamps: true, collection: 'minute_requests' },
);

minuteRequestSchema.index({ adminId: 1, status: 1, createdAt: -1 });
minuteRequestSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  },
);

export const MinuteRequest: Model<MinuteRequestDocument> =
  mongoose.models.MinuteRequest ||
  mongoose.model<MinuteRequestDocument>('MinuteRequest', minuteRequestSchema);

export default MinuteRequest;
