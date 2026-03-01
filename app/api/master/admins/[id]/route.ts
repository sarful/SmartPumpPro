import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { Types } from 'mongoose';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminId = params.id;
  if (!Types.ObjectId.isValid(adminId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  await connectDB();
  const admin = await Admin.findById(adminId).lean();
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await Admin.deleteOne({ _id: adminId });
  return NextResponse.json({ success: true });
}
