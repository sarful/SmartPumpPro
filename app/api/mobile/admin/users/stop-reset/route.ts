import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import Queue from "@/models/Queue";
import { calculateUsedMinutes, stopMotorForUser } from "@/lib/timer-engine";

type Body = { userId?: string };

export async function POST(req: NextRequest) {
  try {
    const payload = getMobileAccessPayload(req);
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

    const user = await User.findOne({ _id: body.userId, adminId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.motorStatus === "RUNNING" || user.motorStatus === "HOLD") {
      const usedMinutes = calculateUsedMinutes(user.motorStartTime, user.lastSetMinutes);
      const remaining =
        user.motorRunningTime && user.motorRunningTime > 0
          ? user.motorRunningTime
          : Math.max(user.lastSetMinutes - usedMinutes, 0);
      const refundedMinutes = Math.max(remaining, 0);

      await stopMotorForUser(String(user._id));
      return NextResponse.json({ success: true, usedMinutes, refundedMinutes });
    }

    await Queue.deleteMany({
      adminId: user.adminId,
      userId: user._id,
      status: { $in: ["WAITING", "RUNNING"] },
    });

    user.motorRunningTime = 0;
    user.lastSetMinutes = 0;
    user.motorStartTime = null;
    user.motorStatus = "OFF";
    await user.save();

    return NextResponse.json({ success: true, usedMinutes: 0, refundedMinutes: 0 });
  } catch (error) {
    console.error("mobile admin stop/reset error", error);
    return NextResponse.json({ error: "Failed to stop/reset user motor" }, { status: 500 });
  }
}
