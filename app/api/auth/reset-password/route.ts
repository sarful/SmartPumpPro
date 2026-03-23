import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api-guard";

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, "auth-reset-password-disabled", 5, 60_000);
  if (limited) return limited;

  return NextResponse.json(
    {
      error: "Self-service password reset is disabled.",
      details:
        "Sign in and change your password from the dashboard, or contact your administrator if you cannot access the account.",
    },
    { status: 403 },
  );
}
