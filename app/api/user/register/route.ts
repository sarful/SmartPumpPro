import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Admin from '@/models/Admin';
import { Types } from 'mongoose';
import { hash } from 'bcryptjs';

type Body = {
  username?: string;
  password?: string;
  adminId?: string;
};

export async function POST(req: NextRequest) {
  try {
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { username, password, adminId } = body ?? {};

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
    }

    if (!adminId || typeof adminId !== 'string' || !Types.ObjectId.isValid(adminId)) {
      return NextResponse.json({ error: 'adminId is required and must be valid' }, { status: 400 });
    }

    await connectDB();

    const admin = await Admin.findOne({ _id: adminId, status: 'active' }).lean();
    if (!admin) {
      return NextResponse.json({ error: 'Admin is not active or not found' }, { status: 400 });
    }

    const existing = await User.findOne({ username: username.trim() }).lean();
    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    const hashed = await hash(password, 10);

    await User.create({
      username: username.trim(),
      password: hashed,
      adminId,
      availableMinutes: 0,
      motorRunningTime: 0,
      motorStatus: 'OFF',
      motorStartTime: null,
      lastSetMinutes: 0,
    });

    return NextResponse.json({ success: true, message: 'User created' });
  } catch (error: any) {
    console.error('User register error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, details: String(error) }, { status: 500 });
  }
}
