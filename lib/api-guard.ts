import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestIpFromHeaderValue } from "@/lib/auth-security";

export function enforceRateLimit(
  req: NextRequest,
  keyPrefix: string,
  max: number,
  windowMs: number,
) {
  const ip = getRequestIpFromHeaderValue(req.headers.get("x-forwarded-for"));
  const result = rateLimit(`${keyPrefix}:${ip}`, max, windowMs);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(result.resetInMs / 1000)),
      },
    },
  );
}

