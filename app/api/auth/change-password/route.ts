import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api-guard";
import { connectDB } from "@/lib/mongodb";
import {
  findAccountByRoleAndId,
  hashPassword,
  updateAccountPasswordByRoleAndId,
  verifyStoredPassword,
} from "@/lib/passwords";
import { reportIncident } from "@/lib/observability";
import { requireWebMutationSession } from "@/lib/web-mutation-auth";

type Body = {
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, "auth-change-password", 8, 60_000);
    if (limited) return limited;

    const authResult = await requireWebMutationSession(["master", "admin", "user"]);
    if (authResult.response) return authResult.response;
    const { session } = authResult;

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

    const account = await findAccountByRoleAndId(session.user.role, session.user.id);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const passwordOk = await verifyStoredPassword(account.password, currentPassword);
    if (!passwordOk) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newPassword);
    await updateAccountPasswordByRoleAndId(session.user.role, session.user.id, hashedPassword);

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    const requestId = await reportIncident({
      error,
      source: "web_change_password",
      route: "/api/auth/change-password",
      platform: "web",
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ error: "Failed to change password", requestId }, { status: 500 });
  }
}
