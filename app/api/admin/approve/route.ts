import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { auth } from '@/lib/auth';
import { Types } from 'mongoose';

type Body = {
  adminId?: string;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { adminId } = body ?? {};

  if (!adminId || !Types.ObjectId.isValid(adminId)) {
    return NextResponse.json({ error: 'adminId is required' }, { status: 400 });
  }

  try {
    await connectDB();
    const updated = await Admin.findOneAndUpdate(
      { _id: adminId, status: 'pending' },
      { status: 'active' },
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: 'Admin not found or already active' }, { status: 404 });
    }

    return NextResponse.json({ success: true, admin: updated });
  } catch (error: any) {
    console.error('Approve admin error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, details: String(error) }, { status: 500 });
  }
}
