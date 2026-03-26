import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { Types } from 'mongoose';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';

type Body = {
  adminId?: string;
};

export async function POST(req: NextRequest) {
  const authResult = await requireWebMutationSession(['master']);
  if (authResult.response) return authResult.response;

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
      { returnDocument: 'after' },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: 'Admin not found or already active' }, { status: 404 });
    }

    return NextResponse.json({ success: true, admin: updated });
  } catch (error) {
    console.error('Approve admin error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, details: String(error) }, { status: 500 });
  }
}
