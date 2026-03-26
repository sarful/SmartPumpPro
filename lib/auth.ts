import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { connectDB } from "@/lib/mongodb";
import MasterAdmin from "@/models/MasterAdmin";
import Admin from "@/models/Admin";
import User from "@/models/User";
import {
  clearFailedAuth,
  ensureNotLocked,
  getServerRequestIp,
  makeThrottleKey,
  registerFailedAuth,
} from "@/lib/auth-security";
import { verifyStoredPassword } from "@/lib/passwords";

type AuthUser = {
  id: string;
  role: "master" | "admin" | "user";
  adminId?: string;
  username: string;
};

const credentialsProvider = Credentials({
  name: "Credentials",
  credentials: {
    username: { label: "Username", type: "text" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (creds) => {
    if (!creds?.username || !creds?.password) return null;
    if (
      process.env.NODE_ENV === "production" &&
      (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32)
    ) {
      console.error("NEXTAUTH_SECRET is missing or too short for production.");
      return null;
    }
    await connectDB();

    const username = typeof creds.username === "string" ? creds.username.trim() : "";
    const password = typeof creds.password === "string" ? creds.password : "";
    const ip = await getServerRequestIp();
    const throttleKey = makeThrottleKey("web", username, ip);
    const lockState = await ensureNotLocked({ key: throttleKey });
    if (!lockState.allowed) {
      return null;
    }

    // Check master admin
    const master = await MasterAdmin.findOne({ username }).lean();
    if (master && (await verifyStoredPassword(master.password, password))) {
      await clearFailedAuth({ key: throttleKey });
      return {
        id: master._id.toString(),
        role: "master",
        username: master.username,
      } as AuthUser;
    }

    // Check active admin
    const admin = await Admin.findOne({ username, status: "active" }).lean();
    if (admin && (await verifyStoredPassword(admin.password, password))) {
      await clearFailedAuth({ key: throttleKey });
      return {
        id: admin._id.toString(),
        role: "admin",
        adminId: admin._id.toString(),
        username: admin.username,
      } as AuthUser;
    }

    // Check user
    const user = await User.findOne({ username, status: { $ne: 'suspended' } }).lean();
    if (user && (await verifyStoredPassword(user.password, password))) {
      await clearFailedAuth({ key: throttleKey });
      return {
        id: user._id.toString(),
        role: "user",
        adminId: user.adminId?.toString(),
        username: user.username,
      } as AuthUser;
    }

    await registerFailedAuth({
      key: throttleKey,
      username,
      ip,
      scope: "web",
    });

    return null;
  },
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [credentialsProvider],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as AuthUser;
        token.sub = u.id;
        token.role = u.role;
        token.adminId = u.adminId;
        token.username = u.username;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || {};
      session.user.id = token.sub as string;
      session.user.role = token.role as AuthUser["role"];
      session.user.adminId = token.adminId as string | undefined;
      session.user.username = token.username as string;
      return session;
    },
  },
});
