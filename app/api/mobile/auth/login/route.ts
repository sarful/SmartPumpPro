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
import { rateLimit } from "@/lib/rate-limit";
import {
  clearFailedAuth,
  ensureNotLocked,
  getRequestIpFromHeaderValue,
  makeThrottleKey,
  registerFailedAuth,
} from "@/lib/auth-security";

type Body = {
  username?: string;
  password?: string;
  deviceId?: string;
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
    const ip = getRequestIpFromHeaderValue(req.headers.get("x-forwarded-for"));
    const limiter = rateLimit(`mobile-login:${ip}`, 10, 60_000);
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 },
      );
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const username = body.username?.trim();
    const password = body.password ?? "";
    const deviceId = body.deviceId?.trim();
    const userAgent = req.headers.get("user-agent") ?? "";
    if (!username || !password) {
      return NextResponse.json({ error: "username and password are required" }, { status: 400 });
    }

    const throttleKey = makeThrottleKey("mobile", username, ip);
    const lockState = await ensureNotLocked({ key: throttleKey });
    if (!lockState.allowed) {
      return NextResponse.json(
        { error: "Account temporarily locked due to failed attempts. Try again later." },
        { status: 429 },
      );
    }

    await connectDB();
    const maxSessions = Number(process.env.MOBILE_MAX_SESSIONS || "5");

    const createSession = async (sessionData: {
      userId: string;
      role: "master" | "admin" | "user";
      username: string;
      adminId?: string;
    }) => {
      // Limit concurrent active sessions per user for safety.
      const activeSessions = await MobileSession.find({
        userId: sessionData.userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
        .sort({ createdAt: 1 })
        .lean();

      if (activeSessions.length >= maxSessions) {
        const overflow = activeSessions.length - maxSessions + 1;
        const toRevoke = activeSessions.slice(0, overflow).map((s) => s._id);
        await MobileSession.updateMany({ _id: { $in: toRevoke } }, { $set: { revokedAt: new Date() } });
      }

      const refreshToken = createRefreshToken();
      await MobileSession.create({
        ...sessionData,
        deviceId,
        userAgent,
        ip,
        lastUsedAt: new Date(),
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: getRefreshExpiryDate(),
      });
      return refreshToken;
    };

    const master = await MasterAdmin.findOne({ username }).lean();
    if (master && (await verifyPassword(master.password, password))) {
      await clearFailedAuth({ key: throttleKey });
      const refreshToken = await createSession({
        userId: master._id.toString(),
        role: "master",
        username: master.username,
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
      await clearFailedAuth({ key: throttleKey });
      const refreshToken = await createSession({
        userId: admin._id.toString(),
        role: "admin",
        username: admin.username,
        adminId: admin._id.toString(),
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
      await clearFailedAuth({ key: throttleKey });
      const adminId = user.adminId?.toString();
      const refreshToken = await createSession({
        userId: user._id.toString(),
        role: "user",
        username: user.username,
        adminId,
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

    await registerFailedAuth({
      key: throttleKey,
      username,
      ip,
      scope: "mobile",
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  } catch (error) {
    console.error("mobile login error", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
