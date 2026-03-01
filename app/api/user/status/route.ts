import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Admin from '@/models/Admin';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'user') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const user = await User.findById(session.user.id).select({ status: 1, suspendReason: 1 }).lean();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const admin = await Admin.findById(user.adminId).select({ status: 1, suspendReason: 1 }).lean();
  return NextResponse.json({
    userStatus: user.status,
    userReason: user.suspendReason,
    adminStatus: admin?.status ?? 'unknown',
    adminReason: admin?.suspendReason,
  });
}
