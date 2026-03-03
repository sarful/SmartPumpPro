import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import MasterAdmin from "@/models/MasterAdmin";
import Admin from "@/models/Admin";
import User from "@/models/User";

type Body = {
  role?: "master" | "admin" | "user";
  username?: string;
  newPassword?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const role = body.role;
    const username = body.username?.trim();
    const newPassword = body.newPassword ?? "";

    if (!role || !username || newPassword.length < 6) {
      return NextResponse.json(
        { error: "role, username and newPassword (min 6) are required" },
        { status: 400 },
      );
    }

    await connectDB();
    const password = await hash(newPassword, 10);

    if (role === "master") {
      const updated = await MasterAdmin.findOneAndUpdate(
        { username },
        { $set: { password } },
        { new: true },
      ).lean();
      if (!updated) {
        return NextResponse.json({ error: "Master admin not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (role === "admin") {
      const updated = await Admin.findOneAndUpdate(
        { username },
        { $set: { password } },
        { new: true },
      ).lean();
      if (!updated) {
        return NextResponse.json({ error: "Admin not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    const updated = await User.findOneAndUpdate(
      { username },
      { $set: { password } },
      { new: true },
    ).lean();
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("reset-password error", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
