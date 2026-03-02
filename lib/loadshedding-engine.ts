import { Types } from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import User from '@/models/User';

const toObjectId = (id: string | Types.ObjectId): Types.ObjectId =>
  typeof id === 'string' ? new Types.ObjectId(id) : id;

export async function activateLoadShedding(adminId: string | Types.ObjectId) {
  await connectDB();
  const adminObjectId = toObjectId(adminId);
  await Admin.updateOne({ _id: adminObjectId }, { loadShedding: true });

  // Pause any running motor(s) for this admin
  await User.updateMany(
    { adminId: adminObjectId, motorStatus: 'RUNNING' },
    { motorStatus: 'HOLD', motorStartTime: null },
  );
}

export async function clearLoadShedding(adminId: string | Types.ObjectId) {
  await connectDB();
  const adminObjectId = toObjectId(adminId);
  await Admin.updateOne({ _id: adminObjectId }, { loadShedding: false });

  // Resume all held motors for this admin (interlock means normally one)
  const now = new Date();
  const heldUsers = await User.find({ adminId: adminObjectId, motorStatus: 'HOLD' });

  for (const user of heldUsers) {
    user.motorStatus = 'RUNNING';
    user.motorStartTime = now;
    // Reset baseline so timer delta starts fresh from current remaining time
    user.lastSetMinutes = user.motorRunningTime ?? user.lastSetMinutes ?? 0;
    await user.save();
  }

  // Return one example (first) resumed user if needed by callers
  const resumed = await User.findOne({ adminId: adminObjectId, motorStatus: 'RUNNING' })
    .select({ _id: 1, username: 1, motorRunningTime: 1 })
    .lean();

  return resumed;
}
