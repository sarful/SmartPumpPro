import mongoose, { Schema, Model, Types } from 'mongoose';

export type MotorStatus = 'OFF' | 'RUNNING' | 'HOLD';

export interface UserDocument extends mongoose.Document {
  username: string;
  password: string;
  rfidUid?: string;
  adminId: Types.ObjectId;
  availableMinutes: number;
  motorRunningTime: number;
  motorStatus: MotorStatus;
  motorStartTime: Date | null;
  lastSetMinutes: number;
  createdAt: Date;
  status: 'active' | 'suspended';
  suspendReason?: string;
}

const userSchema = new Schema<UserDocument>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    rfidUid: {
      type: String,
      trim: true,
      set: (value: unknown) => {
        if (typeof value !== 'string') return undefined;
        const normalized = value.trim().toUpperCase();
        return normalized.length > 0 ? normalized : undefined;
      },
    },
    password: {
      type: String,
      required: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true,
    },
    availableMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    motorRunningTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    motorStatus: {
      type: String,
      enum: ['OFF', 'RUNNING', 'HOLD'],
      default: 'OFF',
    },
    motorStartTime: {
      type: Date,
      default: null,
    },
    lastSetMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    suspendReason: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'users',
  },
);

// Useful compound index for queries by admin and status/queue-related fields.
userSchema.index({ adminId: 1, motorStatus: 1 });
userSchema.index(
  { adminId: 1, rfidUid: 1 },
  {
    unique: true,
    partialFilterExpression: { rfidUid: { $type: 'string' } },
  },
);

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>('User', userSchema);

export default User;
