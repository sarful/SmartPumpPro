import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";
import User from "@/models/User";
import { NextResponse } from "next/server";

type AllowedRole = "master" | "admin" | "user";
type WebMutationSession = {
  user: {
    id: string;
    role: AllowedRole;
    adminId?: string;
    username?: string;
  };
};

export async function requireWebMutationSession(allowedRoles: AllowedRole[]) {
  const session = await auth();
  if (!session || !allowedRoles.includes(session.user.role as AllowedRole)) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  await connectDB();

  if (session.user.role === "admin") {
    const admin = await Admin.findById(session.user.adminId ?? session.user.id)
      .select({ status: 1, suspendReason: 1 })
      .lean();

    if (!admin) {
      return { response: NextResponse.json({ error: "Admin account not found" }, { status: 401 }) };
    }

    if (admin.status !== "active") {
      return {
        response: NextResponse.json(
          { error: admin.suspendReason || "Admin account is not active" },
          { status: 403 },
        ),
      };
    }
  }

  if (session.user.role === "user") {
    const user = await User.findById(session.user.id)
      .select({ status: 1, suspendReason: 1, adminId: 1 })
      .lean();

    if (!user) {
      return { response: NextResponse.json({ error: "User account not found" }, { status: 401 }) };
    }

    if (user.status === "suspended") {
      return {
        response: NextResponse.json(
          { error: user.suspendReason || "User account is suspended" },
          { status: 403 },
        ),
      };
    }

    const admin = await Admin.findById(user.adminId)
      .select({ status: 1, suspendReason: 1 })
      .lean();

    if (admin && admin.status !== "active") {
      return {
        response: NextResponse.json(
          { error: admin.suspendReason || "Your admin account is not active" },
          { status: 403 },
        ),
      };
    }
  }

  return {
    session: {
      user: {
        id: session.user.id,
        role: session.user.role as AllowedRole,
        adminId: session.user.adminId,
        username: session.user.username,
      },
    } satisfies WebMutationSession,
  };
}
