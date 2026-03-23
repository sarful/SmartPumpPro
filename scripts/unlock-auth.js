/* eslint-disable no-console */
require("./_load-env");

const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("[auth:unlock] Missing MONGODB_URI");
  process.exit(1);
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function getArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

async function run() {
  const username = normalizeUsername(getArg("username"));
  const scope = getArg("scope") || "web";

  if (!username) {
    console.error("[auth:unlock] Missing required --username value");
    console.error('[auth:unlock] Example: npm run auth:unlock -- --username=rahim --scope=web');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
  });

  const db = mongoose.connection.db;
  const result = await db.collection("auth_throttles").deleteMany({
    username,
    scope,
  });

  console.log(
    `[auth:unlock] Removed ${result.deletedCount ?? 0} throttle record(s) for ${scope}:${username}`,
  );

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("[auth:unlock] failed", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
