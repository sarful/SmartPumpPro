import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import UsageHistory from "@/models/UsageHistory";

type HistoryLean = {
  _id: unknown;
  event?: string;
  date?: Date;
  usedMinutes?: number;
  addedMinutes?: number;
  userId?: unknown;
  adminId?: unknown;
};

function getPopulatedUsername(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { username?: unknown };
  return typeof record.username === "string" ? record.username : null;
}

export async function GET(req: NextRequest) {
  try {
    const payload = getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limitRaw = Number(new URL(req.url).searchParams.get("limit") || "30");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;

    await connectDB();

    const filter: Record<string, string> = {};
    if (payload.role === "admin") {
      filter.adminId = payload.adminId || payload.sub;
    } else if (payload.role === "user") {
      filter.userId = payload.sub;
    }

    const entries = await UsageHistory.find(filter)
      .populate("userId", "username")
      .populate("adminId", "username")
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    const mapped = (entries as HistoryLean[]).map((entry) => ({
      id: String(entry._id),
      event: entry.event || "unknown",
      date: entry.date || null,
      usedMinutes: entry.usedMinutes ?? null,
      addedMinutes: entry.addedMinutes ?? null,
      userName: getPopulatedUsername(entry.userId),
      adminName: getPopulatedUsername(entry.adminId),
    }));

    return NextResponse.json({ entries: mapped });
  } catch (error) {
    console.error("mobile history error", error);
    return NextResponse.json({ error: "Failed to load history logs" }, { status: 500 });
  }
}
