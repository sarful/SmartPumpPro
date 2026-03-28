import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import User from "@/models/User";
import { logEvent } from "@/lib/usage-logger";

type Body = {
  username?: string;
  password?: string;
};

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

    const username = body.username?.trim();
    const password = body.password ?? "";

    if (!username) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "password must be at least 6 characters" }, { status: 400 });
    }

    await connectDB();
    const exists = await User.findOne({ username }).lean();
    if (exists) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }

    const hashedPassword = await hash(password, 10);
    const created = await User.create({
      username,
      password: hashedPassword,
      adminId: payload.adminId || payload.sub,
      availableMinutes: 0,
      motorRunningTime: 0,
      motorStatus: "OFF",
      motorStartTime: null,
      lastSetMinutes: 0,
      status: "active",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: String(created._id),
        username: created.username,
      },
    });
  } catch (error) {
    console.error("mobile admin create user error", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getMobileAccessPayload(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Only admin role is allowed" }, { status: 403 });
    }

    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    await connectDB();
    const deleted = await User.findOneAndDelete({
      _id: userId,
      adminId: payload.adminId || payload.sub,
    }).lean();

    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await logEvent({
      adminId: payload.adminId || payload.sub,
      userId,
      event: "user_delete",
      currentBalance: deleted.availableMinutes,
      meta: {
        source: "mobile_admin_delete",
        username: deleted.username,
        motorStatus: deleted.motorStatus,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("mobile admin delete user error", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
