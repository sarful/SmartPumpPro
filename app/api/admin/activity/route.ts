import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Queue from '@/models/Queue';
import User from '@/models/User';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const [queue, users] = await Promise.all([
    Queue.find({ adminId: session.user.adminId, status: { $in: ['RUNNING', 'WAITING'] } })
      .sort({ position: 1 })
      .limit(20)
      .populate('userId', 'username')
      .lean(),
    User.find({ adminId: session.user.adminId })
      .select({ username: 1, motorStatus: 1, motorRunningTime: 1, availableMinutes: 1 })
      .lean(),
  ]);

  return NextResponse.json({ queue, users });
}
