import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Admin from '@/models/Admin';
import { Types } from 'mongoose';
import { hash } from 'bcryptjs';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectDB();
  const [users, admins] = await Promise.all([
    User.find({})
      .select({ username: 1, adminId: 1, availableMinutes: 1, motorStatus: 1, motorRunningTime: 1, status: 1, suspendReason: 1 })
      .lean(),
    Admin.find({}).select({ username: 1 }).lean(),
  ]);

  const adminMap = Object.fromEntries(admins.map((a: any) => [String(a._id), a.username]));
  const usersWithAdmin = users.map((u: any) => ({
    ...u,
    adminName: adminMap[String(u.adminId)] ?? u.adminId,
  }));

  return NextResponse.json({ users: usersWithAdmin });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { username?: string; password?: string; adminId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { username, password, adminId } = body ?? {};
  if (!username || !username.trim()) return NextResponse.json({ error: 'username is required' }, { status: 400 });
  if (!password || password.length < 6) return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
  if (!adminId || !Types.ObjectId.isValid(adminId)) return NextResponse.json({ error: 'adminId is required' }, { status: 400 });

  await connectDB();
  const admin = await Admin.findById(adminId).lean();
  if (!admin || admin.status !== 'active') {
    return NextResponse.json({ error: 'Admin not found or inactive' }, { status: 400 });
  }

  const exists = await User.findOne({ username: username.trim() }).lean();
  if (exists) return NextResponse.json({ error: 'Username already exists' }, { status: 400 });

  const hashed = await hash(password, 10);
  const user = await User.create({
    username: username.trim(),
    password: hashed,
    adminId,
    availableMinutes: 0,
    motorRunningTime: 0,
    motorStatus: 'OFF',
    motorStartTime: null,
    lastSetMinutes: 0,
  });

  return NextResponse.json({ success: true, user });
}
