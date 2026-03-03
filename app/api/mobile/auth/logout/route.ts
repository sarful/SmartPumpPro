import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MobileSession from "@/models/MobileSession";
import { hashRefreshToken } from "@/lib/mobile-auth";

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
    await MobileSession.updateOne(
      { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("mobile logout error", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
