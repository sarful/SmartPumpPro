import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MobileSession from "@/models/MobileSession";
import {
  createAccessToken,
  createRefreshToken,
  getRefreshExpiryDate,
  hashRefreshToken,
} from "@/lib/mobile-auth";

type Body = { refreshToken?: string };

export async function POST(req: NextRequest) {
  try {
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const refreshToken = body.refreshToken;
    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
    }

    await connectDB();
    const tokenHash = hashRefreshToken(refreshToken);
    const now = new Date();

    const session = await MobileSession.findOne({
      refreshTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    });

    if (!session) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    const rotatedRefresh = createRefreshToken();
    session.refreshTokenHash = hashRefreshToken(rotatedRefresh);
    session.expiresAt = getRefreshExpiryDate();
    await session.save();

    return NextResponse.json({
      accessToken: createAccessToken({
        sub: session.userId,
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
