import crypto from "crypto";
import { NextRequest } from "next/server";

const DEVICE_SECRET_HEADER = "x-device-key";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function getDeviceSecretConfig() {
  return process.env.ESP32_DEVICE_SECRET?.trim() || "";
}

export function isDeviceSecretConfigured() {
  return getDeviceSecretConfig().length > 0;
}

export function getDeviceSecretHeaderName() {
  return DEVICE_SECRET_HEADER;
}

export function isAuthorizedDeviceRequest(req: NextRequest) {
  const expected = getDeviceSecretConfig();
  const provided = req.headers.get(DEVICE_SECRET_HEADER)?.trim() || "";

  if (!expected || !provided) return false;
  return safeEqual(provided, expected);
}
