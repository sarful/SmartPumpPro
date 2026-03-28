import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import { logEvent } from "@/lib/usage-logger";

type Body = { userId?: string; reason?: string };

export async function POST(req: NextRequest) {
  try {
    const payload = await getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Only admin role is allowed" }, { status: 403 });
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body.userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    await connectDB();
    const adminId = payload.adminId || payload.sub;

    const updated = await User.findOneAndUpdate(
      { _id: body.userId, adminId },
      { status: "suspended", suspendReason: body.reason || "Suspended by admin" },
      { returnDocument: 'after' },
    ).lean();

    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
    await logEvent({
      adminId,
      userId: body.userId,
      event: "user_suspend",
      currentBalance: updated.availableMinutes,
      meta: { source: "mobile_admin_suspend", reason: updated.suspendReason || null },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("mobile admin suspend user error", error);
    return NextResponse.json({ error: "Failed to suspend user" }, { status: 500 });
  }
}
