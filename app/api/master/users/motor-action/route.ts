import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Admin from "@/models/Admin";
import Queue from "@/models/Queue";
import { addToQueue, getQueuePosition } from "@/lib/queue-engine";
import { calculateUsedMinutes, stopMotorForUser } from "@/lib/timer-engine";
import { MIN_RUNTIME_THRESHOLD } from "@/lib/timer-engine";
import { isDeviceReadyEffective } from "@/lib/device-readiness";
import { requireWebMutationSession } from "@/lib/web-mutation-auth";

type Body = {
  userId?: string;
  action?: "start" | "stop_reset" | "stop-reset";
  requestedMinutes?: number;
};

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireWebMutationSession(["master"]);
    if (authResult.response) return authResult.response;

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userId, requestedMinutes } = body ?? {};
    const action = body?.action === "stop-reset" ? "stop_reset" : body?.action;

    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

    await connectDB();
    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (action === "stop_reset") {
      if (user.motorStatus === "RUNNING" || user.motorStatus === "HOLD") {
        const usedMinutes = calculateUsedMinutes(user.motorStartTime, user.lastSetMinutes);
        const remaining =
          user.motorRunningTime && user.motorRunningTime > 0
            ? user.motorRunningTime
            : Math.max(user.lastSetMinutes - usedMinutes, 0);
        const refundedMinutes = Math.max(remaining, 0);

        await stopMotorForUser(String(user._id));
        return NextResponse.json({
          success: true,
          status: "OFF",
          usedMinutes,
          refundedMinutes,
        });
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

      return NextResponse.json({
        success: true,
        status: "OFF",
        usedMinutes: 0,
        refundedMinutes: 0,
      });
    }

    if (action === "start") {
      if (user.status === "suspended") {
        return NextResponse.json({ error: user.suspendReason || "You are suspended" }, { status: 403 });
      }

      const admin = await Admin.findById(user.adminId)
        .select({ status: 1, suspendReason: 1, loadShedding: 1, deviceReady: 1, deviceLastSeenAt: 1 })
        .lean();
      if (admin?.status === "suspended") {
        return NextResponse.json({ error: admin.suspendReason || "You are suspended by admin/master" }, { status: 403 });
      }
      if (admin?.loadShedding) {
        return NextResponse.json({ error: "Load shedding active now" }, { status: 403 });
      }
      if (!isDeviceReadyEffective(admin)) {
        return NextResponse.json({ error: "Your device is not ready" }, { status: 403 });
      }

      const minutes =
        typeof requestedMinutes === "number" && requestedMinutes > 0
          ? Math.floor(requestedMinutes)
          : Math.max(Math.floor(user.lastSetMinutes || 0), MIN_RUNTIME_THRESHOLD + 1);
      if (minutes <= MIN_RUNTIME_THRESHOLD) {
        return NextResponse.json(
          { error: `Requested minutes must be greater than ${MIN_RUNTIME_THRESHOLD}` },
          { status: 400 },
        );
      }

      if (user.availableMinutes < minutes) {
        return NextResponse.json(
          { error: `Insufficient minutes. Need ${minutes}m, available ${user.availableMinutes}m` },
          { status: 400 },
        );
      }

      const entry = await addToQueue(user.adminId, user._id, minutes);
      const queuePosition = await getQueuePosition(user.adminId, user._id);

      return NextResponse.json({
        success: true,
        status: entry.status === "RUNNING" ? "RUNNING" : "WAITING",
        queuePosition: queuePosition ?? 0,
        requestedMinutes: minutes,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("master motor action error", error);
    return NextResponse.json({ error: "Failed to process motor action" }, { status: 500 });
  }
}
