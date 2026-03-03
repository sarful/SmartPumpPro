import mongoose, { Model, Schema } from "mongoose";

export interface MobileSessionDocument extends mongoose.Document {
  userId: string;
  role: "master" | "admin" | "user";
  username: string;
  adminId?: string;
  deviceId?: string;
  userAgent?: string;
  ip?: string;
  lastUsedAt?: Date;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const mobileSessionSchema = new Schema<MobileSessionDocument>(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["master", "admin", "user"], required: true, index: true },
    username: { type: String, required: true, index: true },
    adminId: { type: String },
    deviceId: { type: String, index: true },
    userAgent: { type: String },
    ip: { type: String },
    lastUsedAt: { type: Date, default: Date.now, index: true },
    refreshTokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null, index: true },
  },
  { collection: "mobile_sessions", timestamps: true },
);

mobileSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const MobileSession: Model<MobileSessionDocument> =
  mongoose.models.MobileSession ||
  mongoose.model<MobileSessionDocument>("MobileSession", mobileSessionSchema);

export default MobileSession;
