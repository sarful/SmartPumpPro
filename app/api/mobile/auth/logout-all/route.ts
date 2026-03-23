import { NextRequest, NextResponse } from "next/server";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import { connectDB } from "@/lib/mongodb";
import MobileSession from "@/models/MobileSession";

export async function POST(req: NextRequest) {
  try {
    const payload = await getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    await MobileSession.updateMany(
      { userId: payload.sub, role: payload.role, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("mobile logout-all error", error);
    return NextResponse.json({ error: "Failed to logout all sessions" }, { status: 500 });
  }
}
