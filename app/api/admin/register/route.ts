import { NextResponse, NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import MasterAdmin from '@/models/MasterAdmin';
import SystemState from '@/models/SystemState';
import { hash } from 'bcryptjs';
import { auth } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/api-guard';

type Body = {
  username?: string;
  password?: string;
};

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, 'admin-register', 8, 60_000);
    if (limited) return limited;

    const session = await auth();

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { username, password } = body ?? {};

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
    }

    await connectDB();

    const existing = await Admin.findOne({ username: username.trim() }).lean();
    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    const hashed = await hash(password, 10);

    const settings = await SystemState.findOneAndUpdate(
      { key: "global" },
      { $setOnInsert: { key: "global", manualAdminApproval: true } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    const manualAdminApproval = settings?.manualAdminApproval ?? true;

    const adminPayload: {
      username: string;
      password: string;
      status: 'pending' | 'active';
      loadShedding: boolean;
      createdBy?: string;
    } = {
      username: username.trim(),
      password: hashed,
      status: manualAdminApproval ? 'pending' : 'active',
      loadShedding: false,
    };

    if (session?.user?.role === 'master' && session.user.id) {
      adminPayload.createdBy = session.user.id;
    } else {
      // Compatibility fallback: if older runtime still enforces createdBy required,
      // attach the first master admin id so public registration can stay pending.
      const seedMaster = await MasterAdmin.findOne().select({ _id: 1 }).lean();
      if (seedMaster?._id) {
        adminPayload.createdBy = seedMaster._id.toString();
      }
    }

    await Admin.create(adminPayload);

    return NextResponse.json({
      success: true,
      message: manualAdminApproval
        ? 'Admin created. Waiting for approval.'
        : 'Admin created and auto-approved.',
    });
  } catch (error: any) {
    console.error('Admin register error:', error);
    return NextResponse.json({ error: 'Failed to register admin' }, { status: 500 });
  }
}
