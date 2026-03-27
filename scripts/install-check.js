/* eslint-disable no-console */
require("./_load-env");
const mongoose = require("mongoose");

const requiredEnv = [
  "MONGODB_URI",
  "NEXTAUTH_SECRET",
  "ESP32_DEVICE_SECRET",
  "NEXTAUTH_URL",
  "APP_BASE_URL",
];
const optionalEnv = ["MOBILE_JWT_SECRET", "MOBILE_MAX_SESSIONS"];

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

async function checkMongo(mongoUri) {
  await mongoose.connect(mongoUri, {
    maxPoolSize: 3,
    serverSelectionTimeoutMS: 8000,
  });

  const ping = await mongoose.connection.db.admin().ping();
  await mongoose.disconnect();
  return ping?.ok === 1;
}

async function run() {
  const failures = [];
  const warnings = [];

  for (const key of requiredEnv) {
    if (!readEnv(key)) failures.push(`Missing required env: ${key}`);
  }

  const secret = readEnv("NEXTAUTH_SECRET");
  if (secret && secret.length < 32) {
    failures.push("NEXTAUTH_SECRET must be at least 32 characters");
  }
  const mobileJwt = readEnv("MOBILE_JWT_SECRET");
  if (mobileJwt && mobileJwt.length < 32) {
    failures.push("MOBILE_JWT_SECRET must be at least 32 characters");
  }
  const esp32Secret = readEnv("ESP32_DEVICE_SECRET");
  if (esp32Secret && looksLikePlaceholder(esp32Secret)) {
    failures.push("ESP32_DEVICE_SECRET must be replaced with a real secret");
  }

  const mongoUri = readEnv("MONGODB_URI");
  if (mongoUri) {
    try {
      const ok = await checkMongo(mongoUri);
      if (!ok) failures.push("MongoDB ping failed");
    } catch (error) {
      failures.push(`MongoDB connection failed: ${error.message}`);
    }
  }

  for (const key of optionalEnv) {
    if (!readEnv(key)) warnings.push(`Optional env not set: ${key}`);
  }

  if (warnings.length > 0) {
    console.log("[install-check] warnings:");
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (failures.length > 0) {
    console.error("[install-check] failed:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log("[install-check] PASS");
}

run().catch((error) => {
  console.error("[install-check] unexpected failure", error);
  process.exit(1);
});
