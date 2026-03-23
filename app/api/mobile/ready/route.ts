import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";

export async function GET() {
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  const checks = {
    mongodb: false,
    mobileJwtSecret: Boolean(process.env.MOBILE_JWT_SECRET),
    nextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
    esp32DeviceSecret: Boolean(process.env.ESP32_DEVICE_SECRET),
    cronSecret: Boolean(process.env.CRON_SECRET),
    nextAuthUrl: Boolean(nextAuthUrl),
    appBaseUrl: Boolean(appBaseUrl),
    baseUrlParity: Boolean(nextAuthUrl && appBaseUrl && nextAuthUrl === appBaseUrl),
    maxSessionsConfigured: Boolean(process.env.MOBILE_MAX_SESSIONS),
  };

  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    checks.mongodb = true;
  } catch (error) {
    console.error("mobile ready check mongodb error", error);
  }

  const ok =
    checks.mongodb &&
    checks.mobileJwtSecret &&
    checks.nextAuthSecret &&
    checks.esp32DeviceSecret &&
    checks.cronSecret &&
    checks.nextAuthUrl &&
    checks.appBaseUrl;
  return NextResponse.json({
    ok,
    checks,
    env: {
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      timestamp: new Date().toISOString(),
    },
  });
}
