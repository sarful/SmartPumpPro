import mongoose, { Schema, Model } from 'mongoose';

export interface MasterAdminDocument extends mongoose.Document {
  username: string;
  password: string;
  role: string;
  createdAt: Date;
}

const masterAdminSchema = new Schema<MasterAdminDocument>(
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
    role: {
      type: String,
      default: 'master',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'master_admins',
  },
);

export const MasterAdmin: Model<MasterAdminDocument> =
  mongoose.models.MasterAdmin ||
  mongoose.model<MasterAdminDocument>('MasterAdmin', masterAdminSchema);

export default MasterAdmin;
