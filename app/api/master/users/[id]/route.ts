import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { Types } from 'mongoose';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';

type ParamsObj = { id: string };

export async function DELETE(req: NextRequest, context: { params: Promise<ParamsObj> }) {
  const authResult = await requireWebMutationSession(['master']);
  if (authResult.response) return authResult.response;

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
