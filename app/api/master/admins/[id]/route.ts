import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
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

  await Admin.deleteOne({ _id: adminId });
  return NextResponse.json({ success: true });
}
