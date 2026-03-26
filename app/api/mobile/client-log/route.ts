import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { reportIncident } from "@/lib/observability";

type Body = {
  message?: string;
  stack?: string;
  source?: string;
  level?: "error" | "warn" | "info";
  platform?: "mobile";
  isFatal?: boolean;
  role?: string;
  userId?: string;
  adminId?: string;
  meta?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limiter = rateLimit(`mobile-client-log:${ip}`, 30, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many log events" }, { status: 429 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.message || !body?.source) {
    return NextResponse.json({ error: "message and source are required" }, { status: 400 });
  }

  const requestId = await reportIncident({
    source: body.source,
    route: "/api/mobile/client-log",
    level: body.level ?? "error",
    platform: "mobile",
    message: body.message,
    error: body.stack ? new Error(body.message) : undefined,
    userId: body.userId ?? null,
    adminId: body.adminId ?? null,
    role: body.role ?? null,
    ip,
    userAgent: req.headers.get("user-agent"),
    meta: {
      ...(body.meta ?? {}),
      clientStack: body.stack ?? null,
      isFatal: Boolean(body.isFatal),
    },
  });

  return NextResponse.json({ success: true, requestId });
}
