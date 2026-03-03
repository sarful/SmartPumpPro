import mongoose, { Model, Schema } from "mongoose";

export interface SystemStateDocument extends mongoose.Document {
  key: string;
  manualAdminApproval: boolean;
  updatedAt: Date;
}

const systemStateSchema = new Schema<SystemStateDocument>(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    manualAdminApproval: { type: Boolean, default: true },
  },
  {
    collection: "system_state",
    timestamps: { createdAt: false, updatedAt: true },
  },
);

const SystemState: Model<SystemStateDocument> =
  mongoose.models.SystemState ||
  mongoose.model<SystemStateDocument>("SystemState", systemStateSchema);

export default SystemState;
