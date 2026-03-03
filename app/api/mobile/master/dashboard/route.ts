import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import Admin from "@/models/Admin";
import User from "@/models/User";
import Queue from "@/models/Queue";
import SystemState from "@/models/SystemState";

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

    const adminNameMap = Object.fromEntries(admins.map((a: any) => [String(a._id), a.username]));
    const usersWithAdmin = users.map((u: any) => ({
      id: String(u._id),
      username: u.username,
      adminId: String(u.adminId),
      adminName: adminNameMap[String(u.adminId)] ?? String(u.adminId),
      status: u.status ?? "active",
      suspendReason: u.suspendReason ?? null,
      availableMinutes: u.availableMinutes ?? 0,
      motorStatus: u.motorStatus ?? "OFF",
    }));

    const adminsList = admins.map((a: any) => ({
      id: String(a._id),
      username: a.username,
      status: a.status,
      loadShedding: Boolean(a.loadShedding),
      suspendReason: a.suspendReason ?? null,
    }));

    return NextResponse.json({
      overview: { adminCount, userCount, running, waiting },
      manualAdminApproval: settings?.manualAdminApproval ?? true,
      admins: adminsList,
      pendingAdmins: adminsList.filter((a: any) => a.status === "pending"),
      users: usersWithAdmin,
    });
  } catch (error) {
    console.error("mobile master dashboard error", error);
    return NextResponse.json({ error: "Failed to load master dashboard" }, { status: 500 });
  }
}
