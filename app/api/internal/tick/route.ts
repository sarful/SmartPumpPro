import { NextRequest, NextResponse } from 'next/server';
import { tickCardModeBilling, tickRunningMotors } from '@/lib/timer-engine';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('x-cron-key');
  if (secret && header !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await tickRunningMotors();
    await tickCardModeBilling();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Tick error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
