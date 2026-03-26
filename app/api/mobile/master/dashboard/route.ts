import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import Admin from "@/models/Admin";
import User from "@/models/User";
import Queue from "@/models/Queue";
import SystemState from "@/models/SystemState";
import { getAdminRuntimeState, getUserUseSource } from "@/lib/dashboard-runtime";

type AdminLean = {
  _id: unknown;
  username?: string;
  status?: string;
  loadShedding?: boolean;
  deviceReady?: boolean;
  devicePinHigh?: boolean;
  deviceLastSeenAt?: Date | string | null;
  suspendReason?: string | null;
  cardModeActive?: boolean;
  cardActiveUserId?: unknown;
};

type UserLean = {
  _id: unknown;
  username?: string;
  adminId?: unknown;
  rfidUid?: string | null;
  status?: string;
  suspendReason?: string | null;
  availableMinutes?: number;
  motorStatus?: string;
  motorRunningTime?: number;
};

export async function GET(req: NextRequest) {
  try {
    const payload = await getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "master") {
      return NextResponse.json({ error: "Only master role is allowed" }, { status: 403 });
    }

    await connectDB();
    const [adminCount, userCount, running, waiting, admins, users, settings] = await Promise.all([
      Admin.countDocuments({}),
      User.countDocuments({}),
      Queue.countDocuments({ status: "RUNNING" }),
      Queue.countDocuments({ status: "WAITING" }),
      Admin.find({})
        .select({
          username: 1,
          status: 1,
          loadShedding: 1,
          deviceReady: 1,
          devicePinHigh: 1,
          deviceLastSeenAt: 1,
          suspendReason: 1,
          cardModeActive: 1,
          cardActiveUserId: 1,
        })
        .lean(),
      User.find({})
        .select({
          username: 1,
          adminId: 1,
          rfidUid: 1,
          status: 1,
          suspendReason: 1,
          availableMinutes: 1,
          motorStatus: 1,
          motorRunningTime: 1,
        })
        .lean(),
      SystemState.findOneAndUpdate(
        { key: "global" },
        { $setOnInsert: { key: "global", manualAdminApproval: true } },
        { upsert: true, returnDocument: 'after' },
      ).lean(),
    ]);

    const adminList = admins as AdminLean[];
    const userList = users as UserLean[];

    const adminMetaMap = Object.fromEntries(
      adminList.map((admin) => [
        String(admin._id),
        {
          name: admin.username,
          cardModeActive: Boolean(admin.cardModeActive),
          cardActiveUserId: admin.cardActiveUserId ? String(admin.cardActiveUserId) : null,
        },
      ]),
    );
    const usersWithAdmin = userList.map((user) => {
      const meta = adminMetaMap[String(user.adminId)];
      const useSource = getUserUseSource({
        userId: user._id,
        motorStatus: user.motorStatus,
        cardModeActive: meta?.cardModeActive,
        cardActiveUserId: meta?.cardActiveUserId,
        fallback: "-",
      });
      return {
        id: String(user._id),
        username: user.username,
        adminId: String(user.adminId),
        adminName: meta?.name ?? String(user.adminId),
        rfidUid: user.rfidUid ?? null,
        status: user.status ?? "active",
        suspendReason: user.suspendReason ?? null,
        availableMinutes: user.availableMinutes ?? 0,
        motorStatus: user.motorStatus ?? "OFF",
        motorRunningTime: user.motorRunningTime ?? 0,
        useSource,
      };
    });

    const adminsList = adminList.map((admin) => {
      const runtime = getAdminRuntimeState(admin);
      return {
        id: String(admin._id),
        username: admin.username,
        status: admin.status,
        loadShedding: runtime.effectiveLoadShedding,
        deviceOnline: runtime.deviceOnline,
        deviceReady: runtime.effectiveDeviceReady,
        devicePinHigh: Boolean(admin.devicePinHigh),
        suspendReason: admin.suspendReason ?? null,
      };
    });

    return NextResponse.json({
      overview: { adminCount, userCount, running, waiting },
      manualAdminApproval: settings?.manualAdminApproval ?? true,
      admins: adminsList,
      pendingAdmins: adminsList.filter((admin) => admin.status === "pending"),
      users: usersWithAdmin,
    });
  } catch (error) {
    console.error("mobile master dashboard error", error);
    return NextResponse.json({ error: "Failed to load master dashboard" }, { status: 500 });
  }
}
