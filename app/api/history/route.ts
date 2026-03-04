import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import UsageHistory from '@/models/UsageHistory';

function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const format = (searchParams.get('format') || 'json').toLowerCase();
  const shouldDownload = searchParams.get('download') === '1';

  await connectDB();

  // Master sees all, admin sees own admin, user sees own entries
  const filter: Record<string, string> = {};
  if (session.user.role === 'admin' && session.user.adminId) {
    filter.adminId = session.user.adminId;
  }
  if (session.user.role === 'user' && session.user.id) {
    filter.userId = session.user.id;
  }

  const entries = await UsageHistory.find(filter)
    .populate('userId', 'username')
    .populate('adminId', 'username')
    .sort({ date: -1 })
    .limit(limit)
    .lean();

  if (format === 'csv') {
    const header = ['date', 'event', 'adminUsername', 'userUsername', 'usedMinutes', 'addedMinutes', 'meta'];
    const rows = entries.map((entry: any) =>
      [
        entry.date ? new Date(entry.date).toISOString() : '',
        entry.event ?? '',
        entry.adminId?.username ?? '',
        entry.userId?.username ?? '',
        entry.usedMinutes ?? '',
        entry.addedMinutes ?? '',
        entry.meta ? JSON.stringify(entry.meta) : '',
      ]
        .map(escapeCsv)
        .join(','),
    );
    const csv = [header.join(','), ...rows].join('\n');
    const filename = `history-${session.user.role}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': shouldDownload ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ entries });
}
