import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { hash } from 'bcryptjs';
import Admin from '@/models/Admin';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const admin = await Admin.findById(session.user.adminId).select({ username: 1 }).lean();
  const users = await User.find({ adminId: session.user.adminId })
    .select({
      username: 1,
      rfidUid: 1,
      availableMinutes: 1,
      motorStatus: 1,
      motorRunningTime: 1,
      status: 1,
      suspendReason: 1,
    })
    .lean();
  const usersWithAdmin = users.map((u: any) => ({
    ...u,
    adminName: admin?.username ?? session.user.adminId,
  }));
  return NextResponse.json({ users: usersWithAdmin });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { username, password } = body ?? {};
  if (!username || !username.trim()) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
  }

  await connectDB();
  const exists = await User.findOne({ username: username.trim() }).lean();
  if (exists) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
  }

  const hashed = await hash(password, 10);
  await User.create({
    username: username.trim(),
    password: hashed,
    adminId: session.user.adminId,
    availableMinutes: 0,
    motorRunningTime: 0,
    motorStatus: 'OFF',
    motorStartTime: null,
    lastSetMinutes: 0,
    status: 'active',
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  await connectDB();
  const deleted = await User.findOneAndDelete({ _id: userId, adminId: session.user.adminId }).lean();
  if (!deleted) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
