import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import Admin from "@/models/Admin";
import { addToQueue, getQueuePosition, isMotorBusy } from "@/lib/queue-engine";
import { isDeviceReadyEffective } from "@/lib/device-readiness";
import { MIN_RUNTIME_THRESHOLD } from "@/lib/timer-engine";

type Body = { requestedMinutes?: number };

export async function POST(req: NextRequest) {
  try {
    const payload = await getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "user") {
      return NextResponse.json({ error: "Only user role is allowed" }, { status: 403 });
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const requestedMinutes = body.requestedMinutes;
    if (typeof requestedMinutes !== "number" || Number.isNaN(requestedMinutes) || requestedMinutes <= 0) {
      return NextResponse.json({ error: "requestedMinutes must be > 0" }, { status: 400 });
    }
    if (requestedMinutes <= MIN_RUNTIME_THRESHOLD) {
      return NextResponse.json(
        { error: `Requested minutes must be greater than ${MIN_RUNTIME_THRESHOLD}` },
        { status: 400 },
      );
    }

    await connectDB();

    const user = await User.findById(payload.sub);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.status === "suspended") {
      return NextResponse.json({ error: user.suspendReason || "You are suspended" }, { status: 403 });
    }

    const admin = await Admin.findById(user.adminId)
      .select({ status: 1, suspendReason: 1, loadShedding: 1, deviceReady: 1, deviceLastSeenAt: 1 })
      .lean();
    if (admin && admin.status === "suspended") {
      return NextResponse.json({ error: admin.suspendReason || "You are suspended by admin/master" }, { status: 403 });
    }
    if (admin?.loadShedding) {
      return NextResponse.json({ error: "Load shedding active now" }, { status: 403 });
    }
    if (!isDeviceReadyEffective(admin)) {
      return NextResponse.json({ error: "Your device is not ready" }, { status: 403 });
    }

    if ((user.availableMinutes ?? 0) < requestedMinutes) {
      return NextResponse.json({ error: "Insufficient minutes" }, { status: 400 });
    }

    const busy = await isMotorBusy(user.adminId);
    await addToQueue(user.adminId, user._id, requestedMinutes);
    const queuePosition = await getQueuePosition(String(user.adminId), String(user._id));

    if (busy || (queuePosition ?? 0) > 0) {
      return NextResponse.json({ status: "WAITING", queuePosition: queuePosition ?? undefined });
    }

    return NextResponse.json({ status: "RUNNING", queuePosition: 0 });
  } catch (error) {
    console.error("mobile user start error", error);
    return NextResponse.json({ error: "Failed to start motor" }, { status: 500 });
  }
}
