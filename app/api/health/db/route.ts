import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ ok: true, db: 'connected' });
  } catch (error) {
    console.error('DB health check failed:', error);
    return NextResponse.json(
      { ok: false, db: 'error', message: 'Database connection failed' },
      { status: 500 },
    );
  }
}
