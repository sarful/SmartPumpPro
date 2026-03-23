import { NextRequest, NextResponse } from "next/server";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";

export async function GET(req: NextRequest) {
  const payload = await getMobileAccessPayload(req);
  if (!payload) {
    return NextResponse.json({ error: "Invalid, expired, or revoked access token" }, { status: 401 });
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
