import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";

type Body = {
  userId?: string;
  action?: "suspend" | "unsuspend" | "delete";
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

    const { userId, action, reason } = body ?? {};
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
    }
    if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

    await connectDB();

    if (action === "suspend") {
      const updated = await User.findOneAndUpdate(
        { _id: userId },
        { status: "suspended", suspendReason: reason || "Suspended by master" },
        { new: true },
      ).lean();
      if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    if (action === "unsuspend") {
      const updated = await User.findOneAndUpdate(
        { _id: userId },
        { status: "active", suspendReason: null },
        { new: true },
      ).lean();
      if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    const deleted = await User.deleteOne({ _id: userId });
    if (!deleted.deletedCount) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("mobile master user action error", error);
    return NextResponse.json({ error: "Failed to process user action" }, { status: 500 });
  }
}
