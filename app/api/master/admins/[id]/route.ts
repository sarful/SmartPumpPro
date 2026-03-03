import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import User from '@/models/User';
import Queue from '@/models/Queue';
import MinuteRequest from '@/models/MinuteRequest';
import UsageHistory from '@/models/UsageHistory';
import { Types } from 'mongoose';

type ParamsObj = { id: string };

// Next.js 16 treats params as Promise in route handlers; accept Promise signature directly.
export async function DELETE(req: NextRequest, context: { params: Promise<ParamsObj> }) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: adminId } = await context.params;
  if (!adminId || !Types.ObjectId.isValid(adminId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  await connectDB();
  const admin = await Admin.findById(adminId).lean();
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const adminObjectId = new Types.ObjectId(adminId);

  // Cascade cleanup for tenant isolation: remove all users and admin-scoped records.
  const [usersDelete, queueDelete, requestDelete, usageDelete, adminDelete] = await Promise.all([
    User.deleteMany({ adminId: adminObjectId }),
    Queue.deleteMany({ adminId: adminObjectId }),
    MinuteRequest.deleteMany({ adminId: adminObjectId }),
    UsageHistory.deleteMany({ adminId: adminObjectId }),
    Admin.deleteOne({ _id: adminObjectId }),
  ]);

  return NextResponse.json({
    success: true,
    deleted: {
      admins: adminDelete.deletedCount ?? 0,
      users: usersDelete.deletedCount ?? 0,
      queues: queueDelete.deletedCount ?? 0,
      minuteRequests: requestDelete.deletedCount ?? 0,
      usageHistory: usageDelete.deletedCount ?? 0,
    },
  });
}
