import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import Admin from "@/models/Admin";
import User from "@/models/User";
import Queue from "@/models/Queue";
import SystemState from "@/models/SystemState";

type AdminLean = {
  _id: unknown;
  username?: string;
  status?: string;
  loadShedding?: boolean;
  suspendReason?: string | null;
};

type UserLean = {
  _id: unknown;
  username?: string;
  adminId?: unknown;
  status?: string;
  suspendReason?: string | null;
  availableMinutes?: number;
  motorStatus?: string;
};

export async function GET(req: NextRequest) {
  try {
    const payload = getMobileAccessPayload(req);
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
      Admin.find({}).select({ username: 1, status: 1, loadShedding: 1, suspendReason: 1 }).lean(),
      User.find({})
        .select({ username: 1, adminId: 1, status: 1, suspendReason: 1, availableMinutes: 1, motorStatus: 1 })
        .lean(),
      SystemState.findOneAndUpdate(
        { key: "global" },
        { $setOnInsert: { key: "global", manualAdminApproval: true } },
        { upsert: true, new: true },
      ).lean(),
    ]);

    const adminList = admins as AdminLean[];
    const userList = users as UserLean[];

    const adminNameMap = Object.fromEntries(adminList.map((admin) => [String(admin._id), admin.username]));
    const usersWithAdmin = userList.map((user) => ({
      id: String(user._id),
      username: user.username,
      adminId: String(user.adminId),
      adminName: adminNameMap[String(user.adminId)] ?? String(user.adminId),
      status: user.status ?? "active",
      suspendReason: user.suspendReason ?? null,
      availableMinutes: user.availableMinutes ?? 0,
      motorStatus: user.motorStatus ?? "OFF",
    }));

    const adminsList = adminList.map((admin) => ({
      id: String(admin._id),
      username: admin.username,
      status: admin.status,
      loadShedding: Boolean(admin.loadShedding),
      suspendReason: admin.suspendReason ?? null,
    }));

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
