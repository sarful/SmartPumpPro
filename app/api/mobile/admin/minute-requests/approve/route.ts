import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import MinuteRequest from "@/models/MinuteRequest";
import User from "@/models/User";

type Body = { requestId?: string };

export async function POST(req: NextRequest) {
  try {
    const payload = await getMobileAccessPayload(req);
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

    if (!body.requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    await connectDB();
    const adminId = payload.adminId || payload.sub;

    const request = await MinuteRequest.findOne({
      _id: body.requestId,
      adminId,
      status: "pending",
    });
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const user = await User.findById(request.userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    user.availableMinutes = (user.availableMinutes ?? 0) + request.minutes;
    await user.save();

    request.status = "approved";
    await request.save();

    const { logEvent } = await import("@/lib/usage-logger");
    await logEvent({
      adminId,
      userId: request.userId,
      event: "recharge",
      addedMinutes: request.minutes,
      meta: { requestId: request._id },
    });

    return NextResponse.json({ success: true, availableMinutes: user.availableMinutes });
  } catch (error) {
    console.error("mobile admin approve request error", error);
    return NextResponse.json({ error: "Failed to approve request" }, { status: 500 });
  }
}
