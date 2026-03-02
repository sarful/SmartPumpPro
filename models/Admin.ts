import mongoose, { Schema, Model, Types } from 'mongoose';

export interface AdminDocument extends mongoose.Document {
  username: string;
  password: string;
  status: 'pending' | 'active' | 'suspended';
  createdBy?: Types.ObjectId;
  loadShedding: boolean;
  createdAt: Date;
  suspendReason?: string;
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
