import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { activateLoadShedding, clearLoadShedding } from '@/lib/loadshedding-engine';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled boolean is required' }, { status: 400 });
  }

  await connectDB();
  if (body.enabled) {
    await activateLoadShedding(session.user.adminId!);
  } else {
    await clearLoadShedding(session.user.adminId!);
  }

  const admin = await Admin.findById(session.user.adminId).select({ loadShedding: 1 }).lean();
  if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

  return NextResponse.json({ success: true, loadShedding: admin.loadShedding });
}
