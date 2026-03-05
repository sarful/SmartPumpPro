import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import MinuteRequest from "@/models/MinuteRequest";

type Body = { requestId?: string };

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

    if (!body.requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    await connectDB();
    const adminId = payload.adminId || payload.sub;

    const updated = await MinuteRequest.findOneAndUpdate(
      { _id: body.requestId, adminId, status: "pending" },
      { status: "declined" },
      { returnDocument: 'after' },
    ).lean();

    if (!updated) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("mobile admin decline request error", error);
    return NextResponse.json({ error: "Failed to decline request" }, { status: 500 });
  }
}
