import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import UsageHistory from '@/models/UsageHistory';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  await connectDB();

  // Master sees all, admin sees own admin, user sees own entries
  const filter: Record<string, string> = {};
  if (session.user.role === 'admin' && session.user.adminId) {
    filter.adminId = session.user.adminId;
  }
  if (session.user.role === 'user' && session.user.id) {
    filter.userId = session.user.id;
  }

  const entries = await UsageHistory.find(filter)
    .populate('userId', 'username')
    .populate('adminId', 'username')
    .sort({ date: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ entries });
}
