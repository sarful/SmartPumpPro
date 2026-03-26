import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';

export async function POST(req: NextRequest) {
  const authResult = await requireWebMutationSession(['master']);
  if (authResult.response) return authResult.response;

  let body: { adminId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { adminId } = body ?? {};
  if (!adminId) return NextResponse.json({ error: 'adminId is required' }, { status: 400 });

  await connectDB();
  const updated = await Admin.findOneAndUpdate(
    { _id: adminId },
    { status: 'active', suspendReason: null },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

  return NextResponse.json({ success: true, adminId: updated._id });
}
