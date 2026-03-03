import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import Queue from "@/models/Queue";
import Admin from "@/models/Admin";

type Body = { minutes?: number };

export async function POST(req: NextRequest) {
  try {
    const payload = getMobileAccessPayload(req);
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

    const minutes = body.minutes ?? 1;
    if (typeof minutes !== "number" || Number.isNaN(minutes) || minutes <= 0) {
      return NextResponse.json({ error: "minutes must be > 0" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(payload.sub);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.status === "suspended") {
      return NextResponse.json({ error: user.suspendReason || "User is suspended" }, { status: 403 });
    }
    const admin = await Admin.findById(user.adminId).select({ status: 1, suspendReason: 1 }).lean();
    if (admin && admin.status === "suspended") {
      return NextResponse.json({ error: admin.suspendReason || "Admin suspended" }, { status: 403 });
    }
    if (user.motorStatus !== "RUNNING") {
      return NextResponse.json({ error: "Motor not running" }, { status: 400 });
    }
    if ((user.availableMinutes ?? 0) < minutes) {
      return NextResponse.json({ error: "Insufficient minutes" }, { status: 400 });
    }

    user.availableMinutes = Math.max((user.availableMinutes ?? 0) - minutes, 0);
    user.motorRunningTime = (user.motorRunningTime ?? 0) + minutes;
    user.lastSetMinutes = (user.lastSetMinutes ?? 0) + minutes;
    await user.save();

    await Queue.findOneAndUpdate(
      { adminId: user.adminId, userId: user._id, status: "RUNNING" },
      { $inc: { requestedMinutes: minutes } },
    ).lean();

    return NextResponse.json({
      success: true,
      availableMinutes: user.availableMinutes,
      motorRunningTime: user.motorRunningTime,
    });
  } catch (error) {
    console.error("mobile user extend error", error);
    return NextResponse.json({ error: "Failed to extend motor time" }, { status: 500 });
  }
}
