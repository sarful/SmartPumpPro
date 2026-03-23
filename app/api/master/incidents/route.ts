import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import IncidentLog from "@/models/IncidentLog";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "master") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") || "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const level = searchParams.get("level");
  const source = searchParams.get("source");
  const platform = searchParams.get("platform");

  await connectDB();

  const filter: Record<string, unknown> = {};
  if (level) filter.level = level;
  if (source) filter.source = source;
  if (platform) filter.platform = platform;

  const incidents = await IncidentLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ incidents });
}
