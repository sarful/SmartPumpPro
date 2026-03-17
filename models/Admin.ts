import mongoose, { Schema, Model, Types } from 'mongoose';

export interface AdminDocument extends mongoose.Document {
  username: string;
  password: string;
  status: 'pending' | 'active' | 'suspended';
  createdBy?: Types.ObjectId;
  loadShedding: boolean;
  deviceReady: boolean;
  devicePinHigh?: boolean;
  deviceLastSeenAt?: Date | null;
  createdAt: Date;
  suspendReason?: string;
  cardModeActive?: boolean;
  cardActiveUid?: string | null;
  cardActiveUserId?: Types.ObjectId | null;
  cardActivatedAt?: Date | null;
  cardLastSeenAt?: Date | null;
  cardBilledMinutes?: number;
  cardModeMessage?: string | null;
  cardModeStopReason?: 'removed' | 'insufficient' | 'admin_override' | 'unknown_uid' | null;
}

const adminSchema = new Schema<AdminDocument>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
    },
    suspendReason: { type: String },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'MasterAdmin',
      required: false,
    },
    loadShedding: {
      type: Boolean,
      default: false,
    },
    deviceReady: {
      type: Boolean,
      default: false,
    },
    devicePinHigh: {
      type: Boolean,
      default: false,
    },
    deviceLastSeenAt: {
      type: Date,
      default: null,
    },
    cardModeActive: {
      type: Boolean,
      default: false,
    },
    cardActiveUid: {
      type: String,
      trim: true,
      default: null,
    },
    cardActiveUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cardActivatedAt: {
      type: Date,
      default: null,
    },
    cardLastSeenAt: {
      type: Date,
      default: null,
    },
    cardBilledMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    cardModeMessage: {
      type: String,
      default: null,
    },
    cardModeStopReason: {
      type: String,
      enum: ['removed', 'insufficient', 'admin_override', 'unknown_uid', null],
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'admins',
  },
);

export const Admin: Model<AdminDocument> =
  mongoose.models.Admin || mongoose.model<AdminDocument>('Admin', adminSchema);

export default Admin;
