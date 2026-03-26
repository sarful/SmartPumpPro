import crypto from "crypto";

type MobileRole = "master" | "admin" | "user";

export type MobileAccessPayload = {
  sub: string;
  sid: string;
  role: MobileRole;
  username: string;
  adminId?: string;
  type: "access";
  exp: number;
  iat: number;
};

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

function getSecret() {
  const secret = process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing MOBILE_JWT_SECRET or NEXTAUTH_SECRET");
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("JWT secret too short. Use at least 32 characters in production.");
  }
  return secret;
}

function base64Url(input: Buffer | string) {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return source
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(input: string) {
  return base64Url(crypto.createHmac("sha256", getSecret()).update(input).digest());
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function createAccessToken(payload: Omit<MobileAccessPayload, "type" | "exp" | "iat">) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: MobileAccessPayload = {
    ...payload,
    type: "access",
    iat: now,
    exp: now + ACCESS_TTL_SECONDS,
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(fullPayload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(unsigned);
  return `${unsigned}.${signature}`;
}

export function verifyAccessToken(token: string): MobileAccessPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  if (!safeEqual(encodedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as MobileAccessPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.type !== "access") return null;
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashRefreshToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getRefreshExpiryDate() {
  return new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
}
