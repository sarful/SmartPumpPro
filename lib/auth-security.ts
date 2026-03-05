import { headers } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import AuthThrottle from "@/models/AuthThrottle";

type Scope = "web" | "mobile";

const MAX_ATTEMPTS = Number(process.env.AUTH_MAX_ATTEMPTS || "5");
const WINDOW_MS = Number(process.env.AUTH_WINDOW_MS || String(15 * 60 * 1000));
const LOCKOUT_MS = Number(process.env.AUTH_LOCKOUT_MS || String(15 * 60 * 1000));

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function getRequestIpFromHeaderValue(headerValue: string | null | undefined) {
  return headerValue?.split(",")[0]?.trim() || "unknown";
}

export async function getServerRequestIp() {
  try {
    const h = await headers();
    return getRequestIpFromHeaderValue(h.get("x-forwarded-for"));
  } catch {
    return "unknown";
  }
}

export function makeThrottleKey(scope: Scope, username: string, ip: string) {
  return `${scope}:${normalizeUsername(username)}:${ip}`;
}

export async function ensureNotLocked(params: {
  key: string;
}): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  await connectDB();
  const doc = await AuthThrottle.findOne({ key: params.key })
    .select({ lockedUntil: 1 })
    .lean();
  const now = Date.now();
  const lockedUntilMs = doc?.lockedUntil ? new Date(doc.lockedUntil).getTime() : 0;
  if (lockedUntilMs > now) {
    return { allowed: false, retryAfterMs: lockedUntilMs - now };
  }
  return { allowed: true };
}

export async function registerFailedAuth(params: {
  key: string;
  username: string;
  ip: string;
  scope: Scope;
}) {
  await connectDB();
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  const existing = await AuthThrottle.findOne({ key: params.key });
  if (!existing) {
    await AuthThrottle.create({
      key: params.key,
      username: normalizeUsername(params.username),
      ip: params.ip,
      scope: params.scope,
      failCount: 1,
      firstFailedAt: now,
      lastFailedAt: now,
      lockedUntil: null,
    });
    return;
  }

  const inWindow = existing.lastFailedAt >= windowStart;
  const nextFailCount = inWindow ? existing.failCount + 1 : 1;
  const shouldLock = nextFailCount >= MAX_ATTEMPTS;

  existing.username = normalizeUsername(params.username);
  existing.ip = params.ip;
  existing.scope = params.scope;
  existing.failCount = nextFailCount;
  existing.firstFailedAt = inWindow ? existing.firstFailedAt : now;
  existing.lastFailedAt = now;
  existing.lockedUntil = shouldLock ? new Date(now.getTime() + LOCKOUT_MS) : null;
  await existing.save();
}

export async function clearFailedAuth(params: { key: string }) {
  await connectDB();
  await AuthThrottle.deleteOne({ key: params.key });
}

export function getAuthSecurityConfig() {
  return {
    maxAttempts: MAX_ATTEMPTS,
    windowMs: WINDOW_MS,
    lockoutMs: LOCKOUT_MS,
  };
}

