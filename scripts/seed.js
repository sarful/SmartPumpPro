/* eslint-disable no-console */
require("./_load-env");
const mongoose = require("mongoose");
const { hash } = require("bcryptjs");
const crypto = require("crypto");

const MONGODB_URI = process.env.MONGODB_URI;
const SEED_MASTER_USERNAME = process.env.SEED_MASTER_USERNAME || "master";
const SEED_MASTER_PASSWORD = process.env.SEED_MASTER_PASSWORD;
const SEED_DEMO_DATA = String(process.env.SEED_DEMO_DATA || "false").toLowerCase() === "true";

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

if (!SEED_MASTER_PASSWORD || SEED_MASTER_PASSWORD.length < 8) {
  console.error("Set SEED_MASTER_PASSWORD (min 8 chars). Optional: SEED_MASTER_USERNAME");
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
  });

  const db = mongoose.connection.db;
  const masterAdmins = db.collection("master_admins");
  const systemState = db.collection("system_state");
  const admins = db.collection("admins");
  const users = db.collection("users");

  const username = SEED_MASTER_USERNAME.trim().toLowerCase();
  const existing = await masterAdmins.findOne({ username });
  if (existing) {
    console.log(`[seed] master admin already exists: ${username}`);
  } else {
    const passwordHash = await hash(SEED_MASTER_PASSWORD, 10);
    await masterAdmins.insertOne({
      username,
      password: passwordHash,
      role: "master",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`[seed] created master admin: ${username}`);
  }

  await systemState.updateOne(
    { key: "global" },
    {
      $setOnInsert: {
        key: "global",
        manualAdminApproval: true,
        createdAt: new Date(),
      },
      $set: {
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
  console.log("[seed] ensured global system settings");

  if (!SEED_DEMO_DATA) {
    await mongoose.disconnect();
    return;
  }

  const demoAdminName = "demo_admin";
  const demoUserName = "demo_user";
  const existingDemoAdmin = await admins.findOne({ username: demoAdminName });
  if (!existingDemoAdmin) {
    const demoAdminPassword = await hash(`Admin#${crypto.randomBytes(3).toString("hex")}`, 10);
    const created = await admins.insertOne({
      username: demoAdminName,
      password: demoAdminPassword,
      status: "active",
      createdBy: (await masterAdmins.findOne({ username }, { projection: { _id: 1 } }))._id,
      loadShedding: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`[seed] created demo admin: ${demoAdminName} (${created.insertedId})`);
  }

  const demoAdmin = await admins.findOne({ username: demoAdminName }, { projection: { _id: 1 } });
  const existingDemoUser = await users.findOne({ username: demoUserName });
  if (!existingDemoUser && demoAdmin?._id) {
    const demoUserPassword = await hash(`User#${crypto.randomBytes(3).toString("hex")}`, 10);
    await users.insertOne({
      username: demoUserName,
      password: demoUserPassword,
      adminId: demoAdmin._id,
      availableMinutes: 120,
      motorRunningTime: 0,
      motorStatus: "OFF",
      motorStartTime: null,
      lastSetMinutes: 0,
      status: "active",
      suspendReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`[seed] created demo user: ${demoUserName}`);
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("[seed] failed", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
