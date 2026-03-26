import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { activateLoadShedding, clearLoadShedding } from '@/lib/loadshedding-engine';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';

export async function POST(req: NextRequest) {
  const authResult = await requireWebMutationSession(['admin']);
  if (authResult.response) return authResult.response;
  const { session } = authResult;

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
