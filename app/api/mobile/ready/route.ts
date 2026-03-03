import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";

export async function GET() {
  const checks = {
    mongodb: false,
    mobileJwtSecret: Boolean(process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET),
    maxSessionsConfigured: Boolean(process.env.MOBILE_MAX_SESSIONS),
  };

  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    checks.mongodb = true;
  } catch (error) {
    console.error("mobile ready check mongodb error", error);
  }

  const ok = checks.mongodb && checks.mobileJwtSecret;
  return NextResponse.json({
    ok,
    checks,
    env: {
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      timestamp: new Date().toISOString(),
    },
  });
}
