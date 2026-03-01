import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import MasterAdmin from "@/models/MasterAdmin";
import Admin from "@/models/Admin";
import User from "@/models/User";

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
    await connectDB();

    const username = typeof creds.username === "string" ? creds.username.trim() : "";

    const verifyPassword = async (stored: string | undefined | null, provided: string) => {
      if (!stored) return false;
      try {
        const ok = await compare(provided, stored);
        if (ok) return true;
      } catch {
        /* ignore */
      }
      // Legacy plain text fallback for old seeded data; remove when data cleaned
      if (!stored.startsWith('$2')) return stored === provided;
      return false;
    };

    // Check master admin
    const master = await MasterAdmin.findOne({ username }).lean();
    if (master && (await verifyPassword(master.password, creds.password))) {
      return {
        id: master._id.toString(),
        role: "master",
        username: master.username,
      } as AuthUser;
    }

    // Check active admin
    const admin = await Admin.findOne({ username, status: "active" }).lean();
    if (admin && (await verifyPassword(admin.password, creds.password))) {
      return {
        id: admin._id.toString(),
        role: "admin",
        adminId: admin._id.toString(),
        username: admin.username,
      } as AuthUser;
    }

    // Check user
    const user = await User.findOne({ username, status: { $ne: 'suspended' } }).lean();
    if (user && (await verifyPassword(user.password, creds.password))) {
      return {
        id: user._id.toString(),
        role: "user",
        adminId: user.adminId?.toString(),
        username: user.username,
      } as AuthUser;
    }

    return null;
  },
});

export const { auth, handlers, signIn, signOut } = NextAuth({
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
