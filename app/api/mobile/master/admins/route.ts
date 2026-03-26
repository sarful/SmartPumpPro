import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import Admin from "@/models/Admin";

type Body = {
  username?: string;
  password?: string;
  status?: "pending" | "active";
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
    const status = body.status ?? "pending";

    if (!username) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "password must be at least 6 characters" }, { status: 400 });
    }
    if (!["pending", "active"].includes(status)) {
      return NextResponse.json({ error: "status must be pending or active" }, { status: 400 });
    }

    await connectDB();
    const exists = await Admin.findOne({ username }).lean();
    if (exists) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }

    const hashedPassword = await hash(password, 10);
    const admin = await Admin.create({
      username,
      password: hashedPassword,
      status,
      loadShedding: false,
      createdBy: payload.sub,
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: String(admin._id),
        username: admin.username,
        status: admin.status,
      },
    });
  } catch (error) {
    console.error("mobile master create admin error", error);
    return NextResponse.json({ error: "Failed to create admin" }, { status: 500 });
  }
}
