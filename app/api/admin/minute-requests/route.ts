import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import MinuteRequest from '@/models/MinuteRequest';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const requests = await MinuteRequest.find({ adminId: session.user.adminId, status: 'pending' })
    .sort({ createdAt: -1 })
    .populate('userId', 'username')
    .lean();
  return NextResponse.json({ requests });
}
