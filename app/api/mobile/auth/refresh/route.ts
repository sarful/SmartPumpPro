import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MobileSession from "@/models/MobileSession";
import {
  createAccessToken,
  createRefreshToken,
  getRefreshExpiryDate,
  hashRefreshToken,
} from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";

type Body = { refreshToken?: string; deviceId?: string };

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limiter = rateLimit(`mobile-refresh:${ip}`, 30, 60_000);
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Too many refresh requests. Try again later." },
        { status: 429 },
      );
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const refreshToken = body.refreshToken;
    const deviceId = body.deviceId?.trim();
    const userAgent = req.headers.get("user-agent") ?? "";
    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
    }

    await connectDB();
    const tokenHash = hashRefreshToken(refreshToken);
    const now = new Date();

    const reusedRevoked = await MobileSession.findOne({
      refreshTokenHash: tokenHash,
      revokedAt: { $ne: null },
    }).lean();
    if (reusedRevoked) {
      await MobileSession.updateMany(
        { userId: reusedRevoked.userId, role: reusedRevoked.role, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      return NextResponse.json(
        { error: "Session security event. Please login again." },
        { status: 401 },
      );
    }

    const session = await MobileSession.findOne({
      refreshTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    });

    if (!session) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    if (deviceId && session.deviceId && deviceId !== session.deviceId) {
      session.revokedAt = new Date();
      await session.save();
      return NextResponse.json(
        { error: "Device mismatch. Please login again." },
        { status: 401 },
      );
    }

    const rotatedRefresh = createRefreshToken();
    session.refreshTokenHash = hashRefreshToken(rotatedRefresh);
    session.expiresAt = getRefreshExpiryDate();
    session.lastUsedAt = now;
    session.ip = ip;
    session.userAgent = userAgent;
    if (deviceId) session.deviceId = deviceId;
    await session.save();

    return NextResponse.json({
      accessToken: createAccessToken({
        sub: session.userId,
        sid: session._id.toString(),
        role: session.role,
        username: session.username,
        adminId: session.adminId,
      }),
      refreshToken: rotatedRefresh,
    });
  } catch (error) {
    console.error("mobile refresh error", error);
    return NextResponse.json({ error: "Failed to refresh token" }, { status: 500 });
  }
}
