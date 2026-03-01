import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { hash } from 'bcryptjs';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const admins = await Admin.find({})
    .select({ username: 1, status: 1, loadShedding: 1, createdAt: 1, suspendReason: 1 })
    .lean();
  return NextResponse.json({ admins });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { username?: string; password?: string; status?: 'pending' | 'active' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { username, password, status = 'pending' } = body ?? {};
  if (!username || !username.trim()) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
  }
  if (!['pending', 'active'].includes(status)) {
    return NextResponse.json({ error: 'status must be pending or active' }, { status: 400 });
  }

  await connectDB();
  const exists = await Admin.findOne({ username: username.trim() }).lean();
  if (exists) return NextResponse.json({ error: 'Username already exists' }, { status: 400 });

  const hashed = await hash(password, 10);
  const admin = await Admin.create({
    username: username.trim(),
    password: hashed,
    status,
    loadShedding: false,
    createdBy: session.user.id,
  });

  return NextResponse.json({ success: true, admin });
}
