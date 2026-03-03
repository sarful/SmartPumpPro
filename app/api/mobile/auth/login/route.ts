import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import MasterAdmin from "@/models/MasterAdmin";
import Admin from "@/models/Admin";
import User from "@/models/User";
import MobileSession from "@/models/MobileSession";
import {
  createAccessToken,
  createRefreshToken,
  getRefreshExpiryDate,
  hashRefreshToken,
} from "@/lib/mobile-auth";

type Body = {
  username?: string;
  password?: string;
};

async function verifyPassword(stored: string | undefined | null, provided: string) {
  if (!stored) return false;
  try {
    const ok = await compare(provided, stored);
    if (ok) return true;
  } catch {
    // no-op
  }
  if (!stored.startsWith("$2")) return stored === provided;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const username = body.username?.trim();
    const password = body.password ?? "";
    if (!username || !password) {
      return NextResponse.json({ error: "username and password are required" }, { status: 400 });
    }

    await connectDB();

    const master = await MasterAdmin.findOne({ username }).lean();
    if (master && (await verifyPassword(master.password, password))) {
      const refreshToken = createRefreshToken();
      await MobileSession.create({
        userId: master._id.toString(),
        role: "master",
        username: master.username,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: getRefreshExpiryDate(),
      });

      return NextResponse.json({
        accessToken: createAccessToken({
          sub: master._id.toString(),
          role: "master",
          username: master.username,
        }),
        refreshToken,
        user: { id: master._id.toString(), role: "master", username: master.username },
      });
    }

    const admin = await Admin.findOne({ username, status: "active" }).lean();
    if (admin && (await verifyPassword(admin.password, password))) {
      const refreshToken = createRefreshToken();
      await MobileSession.create({
        userId: admin._id.toString(),
        role: "admin",
        username: admin.username,
        adminId: admin._id.toString(),
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: getRefreshExpiryDate(),
      });

      return NextResponse.json({
        accessToken: createAccessToken({
          sub: admin._id.toString(),
          role: "admin",
          username: admin.username,
          adminId: admin._id.toString(),
        }),
        refreshToken,
        user: {
          id: admin._id.toString(),
          role: "admin",
          username: admin.username,
          adminId: admin._id.toString(),
        },
      });
    }

    const user = await User.findOne({ username, status: { $ne: "suspended" } }).lean();
    if (user && (await verifyPassword(user.password, password))) {
      const adminId = user.adminId?.toString();
      const refreshToken = createRefreshToken();
      await MobileSession.create({
        userId: user._id.toString(),
        role: "user",
        username: user.username,
        adminId,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: getRefreshExpiryDate(),
      });

      return NextResponse.json({
        accessToken: createAccessToken({
          sub: user._id.toString(),
          role: "user",
          username: user.username,
          adminId,
        }),
        refreshToken,
        user: {
          id: user._id.toString(),
          role: "user",
          username: user.username,
          adminId,
        },
      });
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  } catch (error) {
    console.error("mobile login error", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
