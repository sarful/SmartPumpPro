import { randomUUID } from "crypto";
import { connectDB } from "@/lib/mongodb";
import IncidentLog from "@/models/IncidentLog";

type IncidentLevel = "error" | "warn" | "info";
type IncidentPlatform = "web" | "mobile" | "backend" | "device";

type ServerIncidentInput = {
  error?: unknown;
  message?: string;
  source: string;
  route?: string;
  level?: IncidentLevel;
  platform?: IncidentPlatform;
  requestId?: string | null;
  userId?: string | null;
  adminId?: string | null;
  role?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
};

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
    stack: null,
  };
}

export function createRequestId() {
  return randomUUID();
}

export async function reportIncident(input: ServerIncidentInput) {
  const level = input.level ?? "error";
  const platform = input.platform ?? "backend";
  const normalized = normalizeError(input.error);
  const message = input.message ?? normalized.message;
  const requestId = input.requestId ?? createRequestId();

  const payload = {
    level,
    source: input.source,
    route: input.route ?? null,
    platform,
    message,
    stack: normalized.stack,
    requestId,
    userId: input.userId ?? null,
    adminId: input.adminId ?? null,
    role: input.role ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    meta: input.meta ?? {},
  };

  const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleMethod("[incident]", JSON.stringify(payload));

  try {
    await connectDB();
    await IncidentLog.create(payload);
  } catch (persistError) {
    console.error("[incident:persist-failed]", normalizeError(persistError).message);
  }

  return requestId;
}
