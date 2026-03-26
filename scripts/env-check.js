/* eslint-disable no-console */
require("./_load-env");

const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg ? modeArg.split("=")[1] : "runtime";

function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function looksLikePlaceholder(value) {
  return (
    !value ||
    /replace-with/i.test(value) ||
    /your-/i.test(value) ||
    /example/i.test(value) ||
    /changeme/i.test(value)
  );
}

function validateUrl(name, value, failures) {
  if (!value) {
    failures.push(`Missing required env: ${name}`);
    return;
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      failures.push(`${name} must start with http:// or https://`);
    }
  } catch {
    failures.push(`${name} must be a valid URL`);
  }
}

function run() {
  const failures = [];
  const warnings = [];

  const mongoUri = readEnv("MONGODB_URI");
  const nextAuthSecret = readEnv("NEXTAUTH_SECRET");
  const mobileJwtSecret = readEnv("MOBILE_JWT_SECRET");
  const esp32Secret = readEnv("ESP32_DEVICE_SECRET");
  const cronSecret = readEnv("CRON_SECRET");
  const nextAuthUrl = readEnv("NEXTAUTH_URL");
  const appBaseUrl = readEnv("APP_BASE_URL");

  if (!mongoUri) failures.push("Missing required env: MONGODB_URI");
  if (!nextAuthSecret) failures.push("Missing required env: NEXTAUTH_SECRET");
  if (!esp32Secret) failures.push("Missing required env: ESP32_DEVICE_SECRET");
  if (!cronSecret) failures.push("Missing required env: CRON_SECRET");

  if (nextAuthSecret && nextAuthSecret.length < 32) {
    failures.push("NEXTAUTH_SECRET must be at least 32 characters");
  }
  if (mobileJwtSecret && mobileJwtSecret.length < 32) {
    failures.push("MOBILE_JWT_SECRET must be at least 32 characters when set");
  }
  if (!mobileJwtSecret) {
    warnings.push("MOBILE_JWT_SECRET is not set; mobile auth will fall back to NEXTAUTH_SECRET");
  }

  if (looksLikePlaceholder(esp32Secret)) {
    failures.push("ESP32_DEVICE_SECRET must be replaced with a real secret");
  }
  if (looksLikePlaceholder(cronSecret)) {
    failures.push("CRON_SECRET must be replaced with a real secret");
  }

  if (mode === "build" || mode === "start" || mode === "runtime") {
    validateUrl("NEXTAUTH_URL", nextAuthUrl, failures);
    validateUrl("APP_BASE_URL", appBaseUrl, failures);
  } else {
    if (!nextAuthUrl) warnings.push("Optional env not set for dev: NEXTAUTH_URL");
    if (!appBaseUrl) warnings.push("Optional env not set for dev: APP_BASE_URL");
  }

  if (warnings.length > 0) {
    console.log(`[env-check:${mode}] warnings:`);
    for (const warning of warnings) console.log(`  - ${warning}`);
  }

  if (failures.length > 0) {
    console.error(`[env-check:${mode}] failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(`[env-check:${mode}] PASS`);
}

run();
