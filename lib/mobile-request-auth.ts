import { NextRequest } from "next/server";
import { MobileAccessPayload, verifyAccessToken } from "@/lib/mobile-auth";

export function getMobileAccessPayload(req: NextRequest): MobileAccessPayload | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return verifyAccessToken(token);
}
