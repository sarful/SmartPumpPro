import { compare, hash } from "bcryptjs";
import MasterAdmin from "@/models/MasterAdmin";
import Admin from "@/models/Admin";
import User from "@/models/User";

export type AccountRole = "master" | "admin" | "user";

type PasswordDocument = {
  _id: { toString(): string };
  username?: string;
  password?: string | null;
};

export function isBcryptHash(value: string | undefined | null): value is string {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function verifyStoredPassword(
  stored: string | undefined | null,
  provided: string,
) {
  if (!stored) return false;
  if (!isBcryptHash(stored)) return false;
  try {
    return await compare(provided, stored);
  } catch {
    return false;
  }
}

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function findAccountByRoleAndId(role: AccountRole, id: string) {
  if (role === "master") {
    return MasterAdmin.findById(id)
      .select({ username: 1, password: 1 })
      .lean<PasswordDocument | null>();
  }
  if (role === "admin") {
    return Admin.findById(id)
      .select({ username: 1, password: 1 })
      .lean<PasswordDocument | null>();
  }
  return User.findById(id)
    .select({ username: 1, password: 1 })
    .lean<PasswordDocument | null>();
}

export async function updateAccountPasswordByRoleAndId(
  role: AccountRole,
  id: string,
  hashedPassword: string,
) {
  if (role === "master") {
    return MasterAdmin.updateOne({ _id: id }, { $set: { password: hashedPassword } });
  }
  if (role === "admin") {
    return Admin.updateOne({ _id: id }, { $set: { password: hashedPassword } });
  }
  return User.updateOne({ _id: id }, { $set: { password: hashedPassword } });
}
