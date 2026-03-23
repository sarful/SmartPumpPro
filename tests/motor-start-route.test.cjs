const test = require("node:test");
const assert = require("node:assert/strict");
const { withModuleMocks } = require("./helpers/module-mocks.cjs");

test("motor start rejects cross-tenant admin actions", async () => {
  const userModel = {
    findById: async () => ({
      _id: "user-1",
      adminId: "admin-2",
      status: "active",
      availableMinutes: 20,
    }),
  };

  await withModuleMocks("@/app/api/motor/start/route.ts", {
    "@/lib/api-guard": { enforceRateLimit: () => null },
    "@/lib/web-mutation-auth": {
      requireWebMutationSession: async () => ({
        session: { user: { id: "admin-user", role: "admin", adminId: "admin-1" } },
      }),
    },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/models/User": userModel,
    "@/models/Admin": { findById: () => ({ select: () => ({ lean: async () => null }) }) },
    "@/lib/queue-engine": {
      addToQueue: async () => {},
      getQueuePosition: async () => 0,
      isMotorBusy: async () => false,
    },
    "@/lib/device-readiness": { isDeviceReadyEffective: () => true },
    "@/lib/observability": { reportIncident: async () => "req-1" },
  }, async ({ POST }) => {
    const req = new Request("http://localhost/api/motor/start", {
      method: "POST",
      body: JSON.stringify({ userId: "user-1", requestedMinutes: 10 }),
    });

    const res = await POST(req);
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: "Forbidden" });
  });
});

test("motor start enforces the 5-minute minimum", async () => {
  await withModuleMocks("@/app/api/motor/start/route.ts", {
    "@/lib/api-guard": { enforceRateLimit: () => null },
    "@/lib/web-mutation-auth": {
      requireWebMutationSession: async () => ({
        session: { user: { id: "user-1", role: "user", adminId: "admin-1" } },
      }),
    },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/models/User": { findById: async () => null },
    "@/models/Admin": { findById: () => ({ select: () => ({ lean: async () => null }) }) },
    "@/lib/queue-engine": {
      addToQueue: async () => {},
      getQueuePosition: async () => 0,
      isMotorBusy: async () => false,
    },
    "@/lib/device-readiness": { isDeviceReadyEffective: () => true },
    "@/lib/observability": { reportIncident: async () => "req-1" },
  }, async ({ POST }) => {
    const req = new Request("http://localhost/api/motor/start", {
      method: "POST",
      body: JSON.stringify({ userId: "user-1", requestedMinutes: 4 }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "Minimum 5 minutes required" });
  });
});
