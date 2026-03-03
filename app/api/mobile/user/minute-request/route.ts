import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import MinuteRequest from "@/models/MinuteRequest";

type Body = { minutes?: number };

export async function GET(req: NextRequest) {
  try {
    const payload = getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "user") {
      return NextResponse.json({ error: "Only user role is allowed" }, { status: 403 });
    }

    await connectDB();
    const items = await MinuteRequest.find({ userId: payload.sub })
      .sort({ createdAt: -1 })
      .limit(10)
      .select({ minutes: 1, status: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({ requests: items });
  } catch (error) {
    console.error("mobile minute-request GET error", error);
    return NextResponse.json({ error: "Failed to load minute requests" }, { status: 500 });
  }
}

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

    const minutes = body.minutes;
    if (typeof minutes !== "number" || Number.isNaN(minutes) || minutes <= 0) {
      return NextResponse.json({ error: "minutes must be > 0" }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(payload.sub).select({ adminId: 1 }).lean();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existingPending = await MinuteRequest.findOne({
      userId: payload.sub,
      status: "pending",
    }).lean();
    if (existingPending) {
      return NextResponse.json({ error: "Pending request already exists" }, { status: 400 });
    }

    const request = await MinuteRequest.create({
      userId: payload.sub,
      adminId: user.adminId,
      minutes,
      status: "pending",
    });

    return NextResponse.json({ success: true, request });
  } catch (error) {
    console.error("mobile minute-request POST error", error);
    return NextResponse.json({ error: "Failed to create minute request" }, { status: 500 });
  }
}
