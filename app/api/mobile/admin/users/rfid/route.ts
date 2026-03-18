import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import { normalizeRfidUid } from "@/lib/card-mode";

type Body = {
  userId?: string;
  rfidUid?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const payload = getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Only admin role is allowed" }, { status: 403 });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const userId = body.userId;
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const adminId = payload.adminId || payload.sub;
    await connectDB();

    const user = await User.findOne({ _id: userId, adminId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const normalized = normalizeRfidUid(body.rfidUid ?? undefined);

    if (!normalized) {
      user.rfidUid = undefined;
      await user.save();
      return NextResponse.json({ success: true, rfidUid: null });
    }

    const existing = await User.findOne({
      adminId,
      rfidUid: normalized,
      _id: { $ne: user._id },
    })
      .select({ _id: 1 })
      .lean();
    if (existing) {
      return NextResponse.json({ error: "RFID card already assigned to another user" }, { status: 400 });
    }

    user.rfidUid = normalized;
    await user.save();

    return NextResponse.json({ success: true, rfidUid: normalized });
  } catch (error) {
    console.error("mobile admin rfid error", error);
    return NextResponse.json({ error: "Failed to update RFID" }, { status: 500 });
  }
}
