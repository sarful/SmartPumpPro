import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import Queue from "@/models/Queue";
import { calculateUsedMinutes, stopMotorForUser } from "@/lib/timer-engine";

export async function POST(req: NextRequest) {
  try {
    const payload = await getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "user") {
      return NextResponse.json({ error: "Only user role is allowed" }, { status: 403 });
    }

    await connectDB();
    const user = await User.findById(payload.sub);
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
    console.error("mobile user stop error", error);
    return NextResponse.json({ error: "Failed to stop motor" }, { status: 500 });
  }
}
