import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/mobile-auth";

function getBearerToken(req: NextRequest) {
  const value = req.headers.get("authorization");
  if (!value) return null;
  const [scheme, token] = value.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired access token" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: payload.sub,
      role: payload.role,
      username: payload.username,
      adminId: payload.adminId,
    },
  });
}
