import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import User from '@/models/User';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const admin = await Admin.findById(session.user.adminId)
    .select({ status: 1, suspendReason: 1, username: 1, loadShedding: 1, deviceReady: 1, devicePinHigh: 1, deviceLastSeenAt: 1 })
    .lean();
  if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  const userCount = await User.countDocuments({ adminId: session.user.adminId });
  return NextResponse.json({
    adminStatus: admin.status,
    adminReason: admin.suspendReason,
    adminName: admin.username,
    userCount,
  });
}
