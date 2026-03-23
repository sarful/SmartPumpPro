import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import Admin from "@/models/Admin";
import MinuteRequest from "@/models/MinuteRequest";
import {
  getActiveQueueSnapshot,
  getAdminRuntimeState,
  getQueueMetrics,
} from "@/lib/dashboard-runtime";
import { logReadinessTransitions } from "@/lib/usage-logger";

export async function GET(req: NextRequest) {
  try {
    const payload = await getMobileAccessPayload(req);
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

    const adminId = String(user.adminId);
    const userId = String(user._id);
    const [admin, queueEntries, pendingRequest] = await Promise.all([
      Admin.findById(user.adminId)
        .select({
          username: 1,
          status: 1,
          suspendReason: 1,
          loadShedding: 1,
          deviceReady: 1,
          deviceLastSeenAt: 1,
          cardModeActive: 1,
          cardModeMessage: 1,
          cardActiveUserId: 1,
        })
        .lean(),
      getActiveQueueSnapshot(adminId),
      MinuteRequest.findOne({
        userId: user._id,
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .select({ minutes: 1, status: 1 })
        .lean(),
    ]);

    const runtime = getAdminRuntimeState(admin);
    const queueMetrics = getQueueMetrics(queueEntries, userId);
    const relatedUserIds = [queueMetrics.runningUserId, admin?.cardActiveUserId ? String(admin.cardActiveUserId) : null]
      .filter((value): value is string => Boolean(value));

    const relatedUsers =
      relatedUserIds.length > 0
        ? await User.find({ _id: { $in: relatedUserIds } })
            .select({ username: 1, motorRunningTime: 1 })
            .lean()
        : [];

    const relatedUserMap = new Map(
      relatedUsers.map((relatedUser) => [String(relatedUser._id), relatedUser]),
    );
    const runningUser = queueMetrics.runningUserId
      ? relatedUserMap.get(queueMetrics.runningUserId) ?? null
      : null;
    const cardActiveUser = admin?.cardActiveUserId
      ? relatedUserMap.get(String(admin.cardActiveUserId))?.username ?? null
      : null;
    const finalQueueMetrics = getQueueMetrics(
      queueEntries,
      userId,
      runningUser?.motorRunningTime ?? 0,
    );

    await logReadinessTransitions({
      adminId: user.adminId,
      userId: user._id,
      current: {
        deviceReady: runtime.effectiveDeviceReady,
        loadShedding: runtime.effectiveLoadShedding,
        internetOnline: runtime.effectiveDeviceReady,
      },
      meta: { source: "mobile_user_dashboard" },
    });

    return NextResponse.json({
      userId,
      username: user.username,
      adminId,
      adminName: admin?.username ?? null,
      availableMinutes: user.availableMinutes ?? 0,
      motorStatus: user.motorStatus ?? "OFF",
      remainingMinutes: user.motorRunningTime ?? 0,
      queuePosition: finalQueueMetrics.queuePosition,
      runningUser: runningUser?.username ?? null,
      estimatedWait: finalQueueMetrics.estimatedWait,
      loadShedding: runtime.effectiveLoadShedding,
      deviceReady: runtime.effectiveDeviceReady,
      userStatus: user.status ?? "active",
      userSuspendReason: user.suspendReason ?? null,
      adminStatus: admin?.status ?? "active",
      adminSuspendReason: admin?.suspendReason ?? null,
      cardModeActive: Boolean(admin?.cardModeActive),
      cardModeMessage: admin?.cardModeMessage ?? null,
      cardActiveUser,
      pendingMinuteRequest: pendingRequest
        ? { minutes: pendingRequest.minutes, status: pendingRequest.status }
        : null,
    });
  } catch (error) {
    console.error("mobile user dashboard error", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
