import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import Admin from "@/models/Admin";
import Queue from "@/models/Queue";
import MinuteRequest from "@/models/MinuteRequest";
import { getQueuePosition } from "@/lib/queue-engine";

async function estimateWait(adminId: string, userId: string): Promise<number | null> {
  const entry = await Queue.findOne({
    adminId,
    userId,
    status: { $in: ["WAITING", "RUNNING"] },
  })
    .select({ position: 1, status: 1 })
    .lean();

  if (!entry) return null;
  if (entry.status === "RUNNING") return 0;

  const ahead = await Queue.find({
    adminId,
    status: { $in: ["RUNNING", "WAITING"] },
    position: { $lt: entry.position },
  })
    .select({ requestedMinutes: 1 })
    .lean();

  return ahead.reduce((sum, item) => sum + (item.requestedMinutes ?? 0), 0);
}

export async function GET(req: NextRequest) {
  try {
    const payload = getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "user") {
      return NextResponse.json({ error: "Only user role is allowed" }, { status: 403 });
    }

    await connectDB();
    const user = await User.findById(payload.sub)
      .select({
        username: 1,
        adminId: 1,
        availableMinutes: 1,
        motorStatus: 1,
        motorRunningTime: 1,
        status: 1,
        suspendReason: 1,
      })
      .lean();

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const admin = await Admin.findById(user.adminId)
      .select({ username: 1, status: 1, suspendReason: 1, loadShedding: 1 })
      .lean();

    const runningUser = await User.findOne({ adminId: user.adminId, motorStatus: "RUNNING" })
      .select({ username: 1, motorRunningTime: 1 })
      .lean();

    const queuePosition = await getQueuePosition(String(user.adminId), String(user._id));
    const estimatedWait = await estimateWait(String(user.adminId), String(user._id));

    const pendingRequest = await MinuteRequest.findOne({
      userId: user._id,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .select({ minutes: 1, status: 1 })
      .lean();

    return NextResponse.json({
      userId: String(user._id),
      username: user.username,
      adminId: String(user.adminId),
      adminName: admin?.username ?? null,
      availableMinutes: user.availableMinutes ?? 0,
      motorStatus: user.motorStatus ?? "OFF",
      remainingMinutes: user.motorRunningTime ?? 0,
      queuePosition,
      runningUser: runningUser?.username ?? null,
      estimatedWait,
      loadShedding: Boolean(admin?.loadShedding),
      userStatus: user.status ?? "active",
      userSuspendReason: user.suspendReason ?? null,
      adminStatus: admin?.status ?? "active",
      adminSuspendReason: admin?.suspendReason ?? null,
      pendingMinuteRequest: pendingRequest
        ? { minutes: pendingRequest.minutes, status: pendingRequest.status }
        : null,
    });
  } catch (error) {
    console.error("mobile user dashboard error", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
