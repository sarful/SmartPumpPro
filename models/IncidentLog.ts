import mongoose, { Model, Schema } from "mongoose";

export interface IncidentLogDocument extends mongoose.Document {
  level: "error" | "warn" | "info";
  source: string;
  route?: string | null;
  platform?: "web" | "mobile" | "backend" | "device";
  message: string;
  stack?: string | null;
  requestId?: string | null;
  userId?: string | null;
  adminId?: string | null;
  role?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const incidentLogSchema = new Schema<IncidentLogDocument>(
  {
    level: {
      type: String,
      enum: ["error", "warn", "info"],
      default: "error",
      required: true,
      index: true,
    },
    source: { type: String, required: true, index: true },
    route: { type: String, default: null },
    platform: {
      type: String,
      enum: ["web", "mobile", "backend", "device"],
      default: "backend",
      index: true,
    },
    message: { type: String, required: true },
    stack: { type: String, default: null },
    requestId: { type: String, default: null, index: true },
    userId: { type: String, default: null, index: true },
    adminId: { type: String, default: null, index: true },
    role: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    collection: "incident_logs",
  },
);

incidentLogSchema.index({ createdAt: -1, level: 1 });
incidentLogSchema.index({ source: 1, createdAt: -1 });

export const IncidentLog: Model<IncidentLogDocument> =
  mongoose.models.IncidentLog || mongoose.model<IncidentLogDocument>("IncidentLog", incidentLogSchema);

export default IncidentLog;
