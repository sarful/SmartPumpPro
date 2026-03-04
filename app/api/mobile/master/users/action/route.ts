import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import { addToQueue, getQueuePosition } from "@/lib/queue-engine";
import { calculateUsedMinutes, stopMotorForUser } from "@/lib/timer-engine";
import Admin from "@/models/Admin";
import Queue from "@/models/Queue";
import User from "@/models/User";

type Body = {
  userId?: string;
  action?: "suspend" | "unsuspend" | "delete" | "stop_reset" | "stop-reset" | "start";
  requestedMinutes?: number;
  reason?: string;
};

export async function POST(req: NextRequest) {
  try {
    const payload = getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "master") {
      return NextResponse.json({ error: "Only master role is allowed" }, { status: 403 });
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userId, action, requestedMinutes, reason } = body ?? {};
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
    }
    if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

    // Backward-compatible aliases from older/mobile cached builds
    const normalizedAction = action === "stop-reset" ? "stop_reset" : action;

    await connectDB();

    if (normalizedAction === "suspend") {
      const updated = await User.findOneAndUpdate(
        { _id: userId },
        { status: "suspended", suspendReason: reason || "Suspended by master" },
        { new: true },
      ).lean();
      if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    if (normalizedAction === "unsuspend") {
      const updated = await User.findOneAndUpdate(
        { _id: userId },
        { status: "active", suspendReason: null },
        { new: true },
      ).lean();
      if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    if (normalizedAction === "stop_reset") {
      const user = await User.findById(userId);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

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

    if (normalizedAction === "start") {
      const user = await User.findById(userId);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      if (user.status === "suspended") {
        return NextResponse.json({ error: user.suspendReason || "User suspended" }, { status: 403 });
      }

      const admin = await Admin.findById(user.adminId).select({ status: 1, suspendReason: 1 }).lean();
      if (admin?.status === "suspended") {
        return NextResponse.json({ error: admin.suspendReason || "Admin suspended" }, { status: 403 });
      }

      const minutes =
        typeof requestedMinutes === "number" && requestedMinutes > 0
          ? Math.floor(requestedMinutes)
          : Math.max(Math.floor(user.lastSetMinutes || 0), 5);

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

    if (normalizedAction === "delete") {
      const deleted = await User.deleteOne({ _id: userId });
      if (!deleted.deletedCount) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("mobile master user action error", error);
    return NextResponse.json({ error: "Failed to process user action" }, { status: 500 });
  }
}
