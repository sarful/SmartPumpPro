import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "master" | "admin" | "user";
      adminId?: string;
      username?: string;
    };
  }

  interface User {
    id: string;
    role: "master" | "admin" | "user";
    adminId?: string;
    username?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "master" | "admin" | "user";
    adminId?: string;
    username?: string;
  }
}
