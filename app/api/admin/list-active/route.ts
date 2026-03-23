import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Admin from '@/models/Admin';

export async function GET(_req: NextRequest) {
  try {
    await connectDB();
    const admins = await Admin.find({ status: 'active' })
      .select({ username: 1 })
      .lean();

    return NextResponse.json({ admins });
  } catch (error) {
    console.error('List active admins error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, details: String(error) }, { status: 500 });
  }
}
