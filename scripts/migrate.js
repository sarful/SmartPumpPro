/* eslint-disable no-console */
require("./_load-env");
const mongoose = require("mongoose");
const { hash } = require("bcryptjs");

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("[migrate] Missing MONGODB_URI");
  process.exit(1);
}

const MIGRATIONS = [
  {
    id: "001_core_indexes",
    run: ensureIndexes,
  },
  {
    id: "002_hash_legacy_passwords",
    run: hashLegacyPasswords,
  },
];

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
  await db.collection("incident_logs").createIndex({ createdAt: -1, level: 1 });
  await db.collection("incident_logs").createIndex({ source: 1, createdAt: -1 });
  await db.collection("incident_logs").createIndex({ requestId: 1 });
}

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function hashLegacyCollectionPasswords(collection, label) {
  const docs = await collection
    .find(
      { password: { $type: "string" } },
      { projection: { _id: 1, password: 1 } },
    )
    .toArray();

  let updated = 0;
  for (const doc of docs) {
    if (!doc.password || isBcryptHash(doc.password)) continue;
    const hashedPassword = await hash(doc.password, 10);
    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      },
    );
    updated += 1;
  }

  console.log(`[migrate] ${label}: hashed ${updated} legacy password(s)`);
}

async function hashLegacyPasswords(db) {
  await hashLegacyCollectionPasswords(db.collection("master_admins"), "master_admins");
  await hashLegacyCollectionPasswords(db.collection("admins"), "admins");
  await hashLegacyCollectionPasswords(db.collection("users"), "users");
}

async function run() {
  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
  });

  const db = mongoose.connection.db;
  const migrations = db.collection("migrations");

  for (const migration of MIGRATIONS) {
    if (migration.id === "001_core_indexes") {
      await migration.run(db);
    }

    const existing = await migrations.findOne({ id: migration.id });
    if (existing) {
      console.log(`[migrate] ${migration.id} already applied`);
      continue;
    }

    if (migration.id !== "001_core_indexes") {
      await migration.run(db);
    }

    await migrations.insertOne({
      id: migration.id,
      appliedAt: new Date(),
    });

    console.log(`[migrate] applied ${migration.id}`);
  }

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
