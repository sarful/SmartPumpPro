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

  // Resume previously held motor (only one should exist per admin by interlock)
  const held = await User.findOneAndUpdate(
    { adminId: adminObjectId, motorStatus: 'HOLD' },
    { motorStatus: 'RUNNING', motorStartTime: new Date() },
    { sort: { motorRunningTime: -1 }, new: true },
  );

  return held;
}
