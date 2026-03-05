/* eslint-disable no-console */
require("./_load-env");
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("[migrate] Missing MONGODB_URI");
  process.exit(1);
}

const MIGRATION_ID = "001_core_indexes";

async function ensureIndexes(db) {
  await db.collection("admins").createIndex({ username: 1 }, { unique: true });
  await db.collection("admins").createIndex({ status: 1 });
  await db.collection("admins").createIndex({ deviceLastSeenAt: -1 });
  await db.collection("admins").createIndex({ updatedAt: -1 });

  await db.collection("master_admins").createIndex({ username: 1 }, { unique: true });

  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await db.collection("users").createIndex({ adminId: 1 });
  await db.collection("users").createIndex({ adminId: 1, status: 1 });
  await db.collection("users").createIndex({ adminId: 1, motorStatus: 1 });

  await db.collection("queues").createIndex({ adminId: 1, position: 1 });
  await db.collection("queues").createIndex({ adminId: 1, status: 1 });
  await db.collection("queues").createIndex({ userId: 1, status: 1 });

  await db.collection("usage_history").createIndex({ adminId: 1, date: -1 });
  await db.collection("usage_history").createIndex({ userId: 1, date: -1 });
  await db.collection("usage_history").createIndex({ event: 1, date: -1 });

  await db.collection("minute_requests").createIndex({ adminId: 1, status: 1, createdAt: -1 });
  await db.collection("minute_requests").createIndex({ userId: 1, status: 1, createdAt: -1 });

  await db.collection("mobile_sessions").createIndex({ userId: 1, revokedAt: 1, expiresAt: 1 });
  await db.collection("mobile_sessions").createIndex(
    { accessTokenHash: 1 },
    {
      unique: true,
      partialFilterExpression: { accessTokenHash: { $type: "string" } },
    },
  );

  await db.collection("auth_throttles").createIndex({ key: 1 }, { unique: true });
  await db
    .collection("auth_throttles")
    .createIndex({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

  await db.collection("system_state").createIndex({ key: 1 }, { unique: true });
}

async function run() {
  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
  });

  const db = mongoose.connection.db;
  const migrations = db.collection("migrations");

  await ensureIndexes(db);

  const existing = await migrations.findOne({ id: MIGRATION_ID });
  if (existing) {
    console.log(`[migrate] ${MIGRATION_ID} already applied (indexes refreshed)`);
    await mongoose.disconnect();
    return;
  }

  await migrations.insertOne({
    id: MIGRATION_ID,
    appliedAt: new Date(),
  });

  console.log(`[migrate] applied ${MIGRATION_ID}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("[migrate] failed", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
