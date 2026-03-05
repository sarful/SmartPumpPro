import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SystemState from "@/models/SystemState";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "master") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const state = await SystemState.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global", manualAdminApproval: true } },
    { upsert: true, returnDocument: 'after' },
  ).lean();

  return NextResponse.json({
    manualAdminApproval: Boolean(state?.manualAdminApproval),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "master") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { manualAdminApproval?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.manualAdminApproval !== "boolean") {
    return NextResponse.json({ error: "manualAdminApproval must be boolean" }, { status: 400 });
  }

  await connectDB();
  const state = await SystemState.findOneAndUpdate(
    { key: "global" },
    { $set: { manualAdminApproval: body.manualAdminApproval } },
    { upsert: true, returnDocument: 'after' },
  ).lean();

  return NextResponse.json({
    success: true,
    manualAdminApproval: Boolean(state?.manualAdminApproval),
  });
}
