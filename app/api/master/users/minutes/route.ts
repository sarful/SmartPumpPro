import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { logEvent } from "@/lib/usage-logger";
import { requireWebMutationSession } from "@/lib/web-mutation-auth";

type Body = {
  userId?: string;
  minutes?: number;
  action?: "recharge" | "set";
};

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireWebMutationSession(["master"]);
    if (authResult.response) return authResult.response;

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userId, minutes, action } = body ?? {};
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
    }
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }
    if (typeof minutes !== "number" || Number.isNaN(minutes)) {
      return NextResponse.json({ error: "minutes must be a number" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (action === "recharge") {
      if (minutes <= 0) {
        return NextResponse.json({ error: "Recharge minutes must be > 0" }, { status: 400 });
      }
      user.availableMinutes = Math.max((user.availableMinutes ?? 0) + minutes, 0);
      await user.save();

      await logEvent({
        adminId: user.adminId,
        userId: user._id,
        event: "recharge",
        addedMinutes: minutes,
        meta: { source: "master_recharge" },
      });

      return NextResponse.json({ success: true, availableMinutes: user.availableMinutes });
    }

    if (action === "set") {
      if (minutes < 0) {
        return NextResponse.json({ error: "Set minutes must be >= 0" }, { status: 400 });
      }

      const before = user.availableMinutes ?? 0;
      user.availableMinutes = Math.floor(minutes);
      await user.save();

      await logEvent({
        adminId: user.adminId,
        userId: user._id,
        event: "recharge",
        addedMinutes: user.availableMinutes - before,
        meta: { source: "master_set_balance", before, after: user.availableMinutes },
      });

      return NextResponse.json({ success: true, availableMinutes: user.availableMinutes });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("master users minutes error", error);
    return NextResponse.json({ error: "Failed to update user minutes" }, { status: 500 });
  }
}

