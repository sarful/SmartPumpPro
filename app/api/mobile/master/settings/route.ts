import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import SystemState from "@/models/SystemState";

export async function POST(req: NextRequest) {
  try {
    const payload = await getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "master") {
      return NextResponse.json({ error: "Only master role is allowed" }, { status: 403 });
    }

    let body: { manualAdminApproval?: boolean };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body.manualAdminApproval !== "boolean") {
      return NextResponse.json({ error: "manualAdminApproval must be boolean" }, { status: 400 });
    }

    await connectDB();
    const state = await SystemState.findOneAndUpdate(
      { key: "global" },
      { $set: { manualAdminApproval: body.manualAdminApproval } },
      { upsert: true, returnDocument: 'after' },
    ).lean();

    return NextResponse.json({ success: true, manualAdminApproval: Boolean(state?.manualAdminApproval) });
  } catch (error) {
    console.error("mobile master settings error", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
