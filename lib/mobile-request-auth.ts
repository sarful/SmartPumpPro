import { NextRequest } from "next/server";
import { MobileAccessPayload, verifyAccessToken } from "@/lib/mobile-auth";
import { connectDB } from "@/lib/mongodb";
import MobileSession from "@/models/MobileSession";
import Admin from "@/models/Admin";
import User from "@/models/User";
import MasterAdmin from "@/models/MasterAdmin";

export async function getMobileAccessPayload(req: NextRequest): Promise<MobileAccessPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  const payload = verifyAccessToken(token);
  if (!payload?.sid) return null;

  await connectDB();
  const session = await MobileSession.findOne({
    _id: payload.sid,
    userId: payload.sub,
    role: payload.role,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select({ _id: 1 })
    .lean();

  if (!session) return null;

  if (payload.role === "master") {
    const master = await MasterAdmin.findById(payload.sub).select({ _id: 1 }).lean();
    return master ? payload : null;
  }

  if (payload.role === "admin") {
    const admin = await Admin.findById(payload.adminId ?? payload.sub)
      .select({ status: 1 })
      .lean();
    return admin?.status === "active" ? payload : null;
  }

  const user = await User.findById(payload.sub)
    .select({ status: 1, adminId: 1 })
    .lean();
  if (!user || user.status === "suspended") return null;

  const admin = await Admin.findById(user.adminId).select({ status: 1 }).lean();
  return admin?.status === "active" ? payload : null;
}
