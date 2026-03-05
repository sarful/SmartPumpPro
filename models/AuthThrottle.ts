import mongoose, { Document, Model, Schema } from "mongoose";

export interface AuthThrottleDocument extends Document {
  key: string;
  username: string;
  ip: string;
  scope: "web" | "mobile";
  failCount: number;
  firstFailedAt: Date;
  lastFailedAt: Date;
  lockedUntil: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

const AuthThrottleSchema = new Schema<AuthThrottleDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, index: true, trim: true, lowercase: true },
    ip: { type: String, required: true, index: true },
    scope: { type: String, enum: ["web", "mobile"], required: true, index: true },
    failCount: { type: Number, required: true, default: 0, min: 0 },
    firstFailedAt: { type: Date, required: true, default: Date.now },
    lastFailedAt: { type: Date, required: true, default: Date.now },
    lockedUntil: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: "auth_throttles" },
);

// Cleanup records after 30 days of inactivity.
AuthThrottleSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const AuthThrottle: Model<AuthThrottleDocument> =
  (mongoose.models.AuthThrottle as Model<AuthThrottleDocument>) ||
  mongoose.model<AuthThrottleDocument>("AuthThrottle", AuthThrottleSchema);

export default AuthThrottle;

