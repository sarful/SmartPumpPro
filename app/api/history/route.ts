import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import UsageHistory from '@/models/UsageHistory';
import Admin from '@/models/Admin';
import { isDeviceOnline, isDeviceReadyEffective } from '@/lib/device-readiness';

type PopulatedRef = string | { _id?: unknown; username?: string };

type HistoryEntry = {
  _id?: unknown;
  date?: Date | string;
  event?: string;
  adminId?: PopulatedRef;
  userId?: PopulatedRef;
  usedMinutes?: number;
  addedMinutes?: number;
  currentBalance?: number;
  meta?: unknown;
};

type AdminReadinessDoc = {
  _id: unknown;
  loadShedding?: boolean;
  deviceReady?: boolean;
  deviceLastSeenAt?: Date | string | null;
};

function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes' || v === 'ready' || v === 'online') return true;
    if (v === '0' || v === 'false' || v === 'no' || v === 'not ready' || v === 'offline') return false;
  }
  return null;
}

function getReadinessFromMeta(meta: unknown) {
  const obj = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
  const sys = obj.systemReadiness && typeof obj.systemReadiness === 'object'
    ? (obj.systemReadiness as Record<string, unknown>)
    : {};

  const loadShedding = toBool(obj.loadShedding ?? obj.ls ?? sys.loadShedding ?? sys.systemLoadShedding);
  const deviceReady = toBool(obj.deviceReady ?? obj.dev ?? sys.deviceReady ?? sys.systemDeviceReady);
  const internetOnline = toBool(obj.internetOnline ?? obj.internet ?? sys.internetOnline ?? sys.systemInternet);
  return {
    loadShedding: typeof loadShedding === 'boolean' ? (loadShedding ? 'Yes' : 'No') : '',
    deviceReady: typeof deviceReady === 'boolean' ? (deviceReady ? 'Ready' : 'Not Ready') : '',
    internetOnline: typeof internetOnline === 'boolean' ? (internetOnline ? 'Online' : 'Offline') : '',
  };
}

function getEntryAdminId(entry: HistoryEntry): string {
  if (!entry?.adminId) return '';
  if (typeof entry.adminId === 'string') return entry.adminId;
  if (entry.adminId?._id) return String(entry.adminId._id);
  return '';
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 100);
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
  const historyEntries = entries as HistoryEntry[];

  const adminIds = Array.from(
    new Set(historyEntries.map((entry) => getEntryAdminId(entry)).filter(Boolean)),
  );
  const adminDocs = adminIds.length
    ? await Admin.find({ _id: { $in: adminIds } })
        .select({ loadShedding: 1, deviceReady: 1, deviceLastSeenAt: 1 })
        .lean()
    : [];
  const adminReadinessMap = new Map<string, { deviceReady: string; loadShedding: string; internetOnline: string }>();
  for (const admin of adminDocs as AdminReadinessDoc[]) {
    const deviceReady = isDeviceReadyEffective(admin);
    const online = isDeviceOnline(admin.deviceLastSeenAt);
    const load = (Boolean(admin.loadShedding) && online) || !deviceReady;
    adminReadinessMap.set(String(admin._id), {
      deviceReady: deviceReady ? 'Ready' : 'Not Ready',
      loadShedding: load ? 'Yes' : 'No',
      internetOnline: deviceReady ? 'Online' : 'Offline',
    });
  }

  if (format === 'csv') {
    const header = [
      'id',
      'date',
      'event',
      'adminUsername',
      'userUsername',
      'usedMinutes',
      'addedMinutes',
      'currentBalance',
      'systemDeviceReady',
      'systemLoadShedding',
      'systemInternet',
      'meta',
    ];
    const rows = historyEntries.map((entry) =>
      (() => {
        const readinessFromMeta = getReadinessFromMeta(entry.meta);
        const adminFallback = adminReadinessMap.get(getEntryAdminId(entry));
        const readiness = {
          deviceReady: readinessFromMeta.deviceReady || adminFallback?.deviceReady || '',
          loadShedding: readinessFromMeta.loadShedding || adminFallback?.loadShedding || '',
          internetOnline: readinessFromMeta.internetOnline || adminFallback?.internetOnline || '',
        };
        return [
        entry._id ? String(entry._id) : '',
        entry.date ? new Date(entry.date).toISOString() : '',
        entry.event ?? '',
        typeof entry.adminId === 'object' ? entry.adminId?.username ?? '' : '',
        typeof entry.userId === 'object' ? entry.userId?.username ?? '' : '',
        entry.usedMinutes ?? '',
        entry.addedMinutes ?? '',
        entry.currentBalance ?? '',
        readiness.deviceReady,
        readiness.loadShedding,
        readiness.internetOnline,
        entry.meta ? JSON.stringify(entry.meta) : '',
      ];
      })()
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

  return NextResponse.json({ entries: historyEntries });
}
