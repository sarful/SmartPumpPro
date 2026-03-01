import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { adminId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { adminId, reason } = body ?? {};
  if (!adminId) return NextResponse.json({ error: 'adminId is required' }, { status: 400 });

  await connectDB();
  const updated = await Admin.findOneAndUpdate(
    { _id: adminId },
    { status: 'suspended', suspendReason: reason || 'Suspended by master' },
    { new: true },
  ).lean();
  if (!updated) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
