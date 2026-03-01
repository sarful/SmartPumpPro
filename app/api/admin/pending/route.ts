import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { auth } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const admins = await Admin.find({ status: 'pending' })
      .select({ username: 1, status: 1 })
      .lean();
    return NextResponse.json({ admins });
  } catch (error: any) {
    console.error('List pending admins error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, details: String(error) }, { status: 500 });
  }
}
