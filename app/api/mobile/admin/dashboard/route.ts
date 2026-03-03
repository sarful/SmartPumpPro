import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import Admin from "@/models/Admin";
import User from "@/models/User";
import MinuteRequest from "@/models/MinuteRequest";
import Queue from "@/models/Queue";

export async function GET(req: NextRequest) {
  try {
    const payload = getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Only admin role is allowed" }, { status: 403 });
    }

    const adminId = payload.adminId || payload.sub;

    await connectDB();

    const admin = await Admin.findById(adminId)
      .select({ username: 1, status: 1, suspendReason: 1, loadShedding: 1 })
      .lean();
    if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

    const users = await User.find({ adminId })
      .select({
        username: 1,
        availableMinutes: 1,
        motorStatus: 1,
        motorRunningTime: 1,
        status: 1,
        suspendReason: 1,
      })
      .sort({ createdAt: -1 })
      .lean();

    const requests = await MinuteRequest.find({ adminId, status: "pending" })
      .sort({ createdAt: -1 })
      .populate("userId", "username")
      .lean();

    const queue = await Queue.find({ adminId, status: { $in: ["RUNNING", "WAITING"] } })
      .sort({ position: 1 })
      .populate("userId", "username")
      .select({ position: 1, status: 1, requestedMinutes: 1, userId: 1 })
      .lean();

    return NextResponse.json({
      admin: {
        id: String(admin._id),
        username: admin.username,
        status: admin.status,
        suspendReason: admin.suspendReason ?? null,
        loadShedding: Boolean(admin.loadShedding),
      },
      users: users.map((u: any) => ({
        id: String(u._id),
        username: u.username,
        availableMinutes: u.availableMinutes ?? 0,
        motorStatus: u.motorStatus ?? "OFF",
        motorRunningTime: u.motorRunningTime ?? 0,
        status: u.status ?? "active",
        suspendReason: u.suspendReason ?? null,
      })),
      pendingRequests: requests.map((r: any) => ({
        id: String(r._id),
        userId: typeof r.userId === "object" ? String(r.userId?._id) : String(r.userId),
        username: typeof r.userId === "object" ? r.userId?.username : null,
        minutes: r.minutes,
        createdAt: r.createdAt,
      })),
      queue: queue.map((q: any) => ({
        id: String(q._id),
        position: q.position,
        status: q.status,
        requestedMinutes: q.requestedMinutes,
        username: typeof q.userId === "object" ? q.userId?.username : null,
      })),
    });
  } catch (error) {
    console.error("mobile admin dashboard error", error);
    return NextResponse.json({ error: "Failed to load admin dashboard" }, { status: 500 });
  }
}
