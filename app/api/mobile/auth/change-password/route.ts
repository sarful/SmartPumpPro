import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MobileSession from "@/models/MobileSession";
import { getMobileAccessPayload } from "@/lib/mobile-request-auth";
import {
  findAccountByRoleAndId,
  hashPassword,
  updateAccountPasswordByRoleAndId,
  verifyStoredPassword,
} from "@/lib/passwords";
import { enforceRateLimit } from "@/lib/api-guard";

type Body = {
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, "mobile-change-password", 8, 60_000);
    if (limited) return limited;

    const payload = await getMobileAccessPayload(req);
    if (!payload?.sub || !payload.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "currentPassword and newPassword are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 },
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "New password must be different from current password" },
        { status: 400 },
      );
    }

    await connectDB();

    const account = await findAccountByRoleAndId(payload.role, payload.sub);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const passwordOk = await verifyStoredPassword(account.password, currentPassword);
    if (!passwordOk) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newPassword);
    await updateAccountPasswordByRoleAndId(payload.role, payload.sub, hashedPassword);

    await MobileSession.updateMany(
      { userId: payload.sub, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    return NextResponse.json({
      success: true,
      message: "Password updated. Please sign in again on all devices.",
    });
  } catch (error) {
    console.error("mobile change-password error", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
