import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { hash } from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import Admin from "@/models/Admin";
import User from "@/models/User";

type Body = {
  username?: string;
  password?: string;
  adminId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const payload = await getMobileAccessPayload(req);
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

    const username = body.username?.trim();
    const password = body.password ?? "";
    const adminId = body.adminId;

    if (!username) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "password must be at least 6 characters" }, { status: 400 });
    }
    if (!adminId || !Types.ObjectId.isValid(adminId)) {
      return NextResponse.json({ error: "adminId is required" }, { status: 400 });
    }

    await connectDB();
    const admin = await Admin.findById(adminId).lean();
    if (!admin || admin.status !== "active") {
      return NextResponse.json({ error: "Admin not found or inactive" }, { status: 400 });
    }

    const exists = await User.findOne({ username }).lean();
    if (exists) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }

    const hashedPassword = await hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      adminId,
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
        id: String(user._id),
        username: user.username,
        adminId: String(user.adminId),
      },
    });
  } catch (error) {
    console.error("mobile master create user error", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
