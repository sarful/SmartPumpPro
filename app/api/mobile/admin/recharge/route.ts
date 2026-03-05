import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";

type Body = { userId?: string; minutes?: number };

export async function POST(req: NextRequest) {
  try {
    const payload = getMobileAccessPayload(req);
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

    const { userId, minutes } = body ?? {};
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (typeof minutes !== "number" || Number.isNaN(minutes) || minutes <= 0) {
      return NextResponse.json({ error: "minutes must be > 0" }, { status: 400 });
    }

    await connectDB();
    const adminId = payload.adminId || payload.sub;

    const user = await User.findOneAndUpdate(
      { _id: userId, adminId },
      { $inc: { availableMinutes: minutes } },
      { returnDocument: 'after' },
    ).lean();

    if (!user) {
      return NextResponse.json({ error: "User not found or not under this admin" }, { status: 404 });
    }

    const { logEvent } = await import("@/lib/usage-logger");
    await logEvent({
      adminId,
      userId,
      event: "recharge",
      addedMinutes: minutes,
    });

    return NextResponse.json({ success: true, availableMinutes: user.availableMinutes });
  } catch (error) {
    console.error("mobile admin recharge error", error);
    return NextResponse.json({ error: "Failed to recharge" }, { status: 500 });
  }
}
