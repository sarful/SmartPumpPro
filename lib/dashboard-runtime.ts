import { connectDB } from "@/lib/mongodb";
import { isDeviceOnline, isDeviceReadyEffective } from "@/lib/device-readiness";
import Queue from "@/models/Queue";

type AdminRuntimeInput = {
  loadShedding?: boolean | null;
  deviceReady?: boolean | null;
  deviceLastSeenAt?: Date | string | null;
  cardModeActive?: boolean | null;
  cardActiveUserId?: unknown;
};

type UseSourceInput = {
  userId: unknown;
  motorStatus?: string | null;
  cardModeActive?: boolean | null;
  cardActiveUserId?: unknown;
  fallback?: string | null;
};

export type QueueSnapshotEntry = {
  id: string;
  userId: string;
  position: number;
  status: string;
  requestedMinutes: number;
};

export function getAdminRuntimeState(admin?: AdminRuntimeInput | null) {
  const deviceOnline = isDeviceOnline(admin?.deviceLastSeenAt ?? null);
  const effectiveDeviceReady = isDeviceReadyEffective(admin);
  const effectiveLoadShedding = Boolean(admin?.loadShedding) && deviceOnline;

  return {
    deviceOnline,
    effectiveDeviceReady,
    effectiveLoadShedding,
  };
}

export function getUserUseSource({
  userId,
  motorStatus,
  cardModeActive,
  cardActiveUserId,
  fallback = null,
}: UseSourceInput): string | null {
  if (cardModeActive && String(cardActiveUserId ?? "") === String(userId)) {
    return "Card";
  }

  if (motorStatus === "RUNNING") {
    return "Web";
  }

  return fallback;
}

export async function getActiveQueueSnapshot(adminId: string): Promise<QueueSnapshotEntry[]> {
  await connectDB();

  const entries = await Queue.find({
    adminId,
    status: { $in: ["RUNNING", "WAITING"] },
  })
    .sort({ position: 1 })
    .select({ userId: 1, position: 1, status: 1, requestedMinutes: 1 })
    .lean();

  return entries.map((entry) => ({
    id: String(entry._id),
    userId: String(entry.userId),
    position: entry.position ?? 0,
    status: entry.status ?? "WAITING",
    requestedMinutes: entry.requestedMinutes ?? 0,
  }));
}

export function getQueueMetrics(
  entries: QueueSnapshotEntry[],
  userId: string,
  runningMinutesRemaining = 0,
): {
  queuePosition: number | null;
  estimatedWait: number | null;
  runningUserId: string | null;
} {
  const targetEntry = entries.find((entry) => entry.userId === userId);
  const runningEntry = entries.find((entry) => entry.status === "RUNNING") ?? null;

  if (!targetEntry) {
    return {
      queuePosition: null,
      estimatedWait: null,
      runningUserId: runningEntry?.userId ?? null,
    };
  }

  if (targetEntry.status === "RUNNING") {
    return {
      queuePosition: 0,
      estimatedWait: 0,
      runningUserId: runningEntry?.userId ?? null,
    };
  }

  const waitingAhead = entries.filter(
    (entry) => entry.status === "WAITING" && entry.position < targetEntry.position,
  );

  const estimatedWait =
    (runningEntry ? runningMinutesRemaining || runningEntry.requestedMinutes : 0) +
    waitingAhead.reduce((sum, entry) => sum + entry.requestedMinutes, 0);

  return {
    queuePosition: waitingAhead.length + 1,
    estimatedWait,
    runningUserId: runningEntry?.userId ?? null,
  };
}
