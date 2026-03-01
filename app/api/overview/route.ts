import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import User from '@/models/User';

export async function GET(_req: NextRequest) {
  await connectDB();
  const [admins, users] = await Promise.all([
    Admin.countDocuments({ status: 'active' }),
    User.countDocuments({}),
  ]);
  return NextResponse.json({ admins, users });
}
