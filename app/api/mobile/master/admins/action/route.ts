import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import Admin from "@/models/Admin";
import User from "@/models/User";
import Queue from "@/models/Queue";
import MinuteRequest from "@/models/MinuteRequest";
import UsageHistory from "@/models/UsageHistory";

type Body = {
  adminId?: string;
  action?: "approve" | "suspend" | "unsuspend" | "delete";
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

    const { adminId, action, reason } = body ?? {};
    if (!adminId || !Types.ObjectId.isValid(adminId)) {
      return NextResponse.json({ error: "Valid adminId is required" }, { status: 400 });
    }
    if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

    await connectDB();
    const adminObjectId = new Types.ObjectId(adminId);

    if (action === "approve") {
      const updated = await Admin.findOneAndUpdate(
        { _id: adminObjectId, status: "pending" },
        { status: "active", suspendReason: null },
        { new: true },
      ).lean();
      if (!updated) {
        return NextResponse.json({ error: "Admin not found or already active" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "suspend") {
      const updated = await Admin.findOneAndUpdate(
        { _id: adminObjectId },
        { status: "suspended", suspendReason: reason || "Suspended by master" },
        { new: true },
      ).lean();
      if (!updated) return NextResponse.json({ error: "Admin not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    if (action === "unsuspend") {
      const updated = await Admin.findOneAndUpdate(
        { _id: adminObjectId },
        { status: "active", suspendReason: null },
        { new: true },
      ).lean();
      if (!updated) return NextResponse.json({ error: "Admin not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const admin = await Admin.findById(adminObjectId).lean();
      if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

      const [usersDelete, queueDelete, requestDelete, usageDelete, adminDelete] = await Promise.all([
        User.deleteMany({ adminId: adminObjectId }),
        Queue.deleteMany({ adminId: adminObjectId }),
        MinuteRequest.deleteMany({ adminId: adminObjectId }),
        UsageHistory.deleteMany({ adminId: adminObjectId }),
        Admin.deleteOne({ _id: adminObjectId }),
      ]);

      return NextResponse.json({
        success: true,
        deleted: {
          admins: adminDelete.deletedCount ?? 0,
          users: usersDelete.deletedCount ?? 0,
          queues: queueDelete.deletedCount ?? 0,
          minuteRequests: requestDelete.deletedCount ?? 0,
          usageHistory: usageDelete.deletedCount ?? 0,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("mobile master admin action error", error);
    return NextResponse.json({ error: "Failed to process admin action" }, { status: 500 });
  }
}
