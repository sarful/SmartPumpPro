import { NextRequest, NextResponse } from 'next/server';
import { tickUnifiedMotorSessions } from '@/lib/timer-engine';
import { reportIncident } from '@/lib/observability';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get('x-cron-key')?.trim();
  const authorization = req.headers.get('authorization')?.trim();
  const bearer = secret ? `Bearer ${secret}` : null;

  if (!secret) {
    return NextResponse.json(
      {
        error: 'Cron auth is not configured',
        details: 'Set CRON_SECRET on the server before enabling scheduler calls.',
      },
      { status: 503 },
    );
  }

  const authorized = header === secret || (bearer !== null && authorization === bearer);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await tickUnifiedMotorSessions();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const requestId = await reportIncident({
      error,
      source: 'internal_tick',
      route: '/api/internal/tick',
      platform: 'backend',
      ip: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    });
    return NextResponse.json({ ok: false, error: message, requestId }, { status: 500 });
  }
}
