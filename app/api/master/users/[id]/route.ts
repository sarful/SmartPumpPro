import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { Types } from 'mongoose';

type ParamsObj = { id: string };

export async function DELETE(req: NextRequest, context: { params: Promise<ParamsObj> }) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId } = await context.params;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(userId).lean();
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await User.deleteOne({ _id: userId });
  return NextResponse.json({ success: true });
}
