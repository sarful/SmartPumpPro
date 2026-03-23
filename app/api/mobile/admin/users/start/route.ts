import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import Admin from "@/models/Admin";
import { addToQueue, getQueuePosition, isMotorBusy } from "@/lib/queue-engine";
import { isDeviceReadyEffective } from "@/lib/device-readiness";

type Body = {
  userId?: string;
  requestedMinutes?: number;
};

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

    const user = await User.findOne({ _id: body.userId, adminId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.status === "suspended") {
      return NextResponse.json({ error: user.suspendReason || "You are suspended" }, { status: 403 });
    }

    const admin = await Admin.findById(adminId)
      .select({ status: 1, suspendReason: 1, loadShedding: 1, deviceReady: 1, deviceLastSeenAt: 1 })
      .lean();
    if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    if (admin.status === "suspended") {
      return NextResponse.json({ error: admin.suspendReason || "You are suspended by master" }, { status: 403 });
    }
    if (admin.loadShedding) {
      return NextResponse.json({ error: "Load shedding active now" }, { status: 403 });
    }
    if (!isDeviceReadyEffective(admin)) {
      return NextResponse.json({ error: "Your device is not ready" }, { status: 403 });
    }

    const requestedMinutes =
      typeof body.requestedMinutes === "number" && body.requestedMinutes > 0
        ? Math.floor(body.requestedMinutes)
        : Math.max(Math.floor(user.lastSetMinutes || user.motorRunningTime || 0), 5);
    if (requestedMinutes < 5) {
      return NextResponse.json({ error: "Minimum 5 minutes required" }, { status: 400 });
    }

    const minRequired = Math.max(requestedMinutes, 5);
    if ((user.availableMinutes ?? 0) < minRequired) {
      return NextResponse.json(
        { error: `Insufficient minutes. Need ${requestedMinutes}m, available ${user.availableMinutes ?? 0}m` },
        { status: 400 },
      );
    }

    const busy = await isMotorBusy(user.adminId);
    const entry = await addToQueue(user.adminId, user._id, requestedMinutes);
    const queuePosition = await getQueuePosition(String(user.adminId), String(user._id));

    if (busy || (queuePosition ?? 0) > 0 || entry.status !== "RUNNING") {
      return NextResponse.json({
        success: true,
        status: "WAITING",
        queuePosition: queuePosition ?? undefined,
      });
    }

    return NextResponse.json({ success: true, status: "RUNNING", queuePosition: 0 });
  } catch (error) {
    console.error("mobile admin start error", error);
    return NextResponse.json({ error: "Failed to start user motor" }, { status: 500 });
  }
}

