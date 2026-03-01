import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Queue from '@/models/Queue';

export async function GET() {
  try {
    await connectDB();
    const running = await Queue.countDocuments({ status: 'RUNNING' });
    const waiting = await Queue.countDocuments({ status: 'WAITING' });
    return NextResponse.json({ ok: true, running, waiting });
  } catch (error: any) {
    console.error('Queue health error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
