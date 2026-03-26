const test = require("node:test");
const assert = require("node:assert/strict");
const { withModuleMocks } = require("./helpers/module-mocks.cjs");

test("minute-request route blocks duplicate pending requests", async () => {
  const minuteRequestModel = {
    findOne: () => ({
      lean: async () => ({ _id: "pending-1" }),
    }),
  };

  const userModel = {
    findById: () => ({
      select: () => ({
        lean: async () => ({ adminId: "admin-1" }),
      }),
    }),
  };

  await withModuleMocks("@/app/api/user/minute-request/route.ts", {
    "@/models/MinuteRequest": minuteRequestModel,
    "@/models/User": userModel,
    "@/lib/auth": { auth: async () => null },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/web-mutation-auth": {
      requireWebMutationSession: async () => ({
        session: { user: { id: "user-1", role: "user", adminId: "admin-1" } },
      }),
    },
  }, async ({ POST }) => {
    const req = new Request("http://localhost/api/user/minute-request", {
      method: "POST",
      body: JSON.stringify({ minutes: 15 }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), {
      error: "Pending request already exists",
    });
  });
});

test("minute-request route creates a pending request when none exists", async () => {
  let createdRequest = null;
  const minuteRequestModel = {
    findOne: () => ({
      lean: async () => null,
    }),
    create: async (payload) => {
      createdRequest = payload;
      return { _id: "req-1", ...payload };
    },
  };

  const userModel = {
    findById: () => ({
      select: () => ({
        lean: async () => ({ adminId: "admin-1" }),
      }),
    }),
  };

  await withModuleMocks("@/app/api/user/minute-request/route.ts", {
    "@/models/MinuteRequest": minuteRequestModel,
    "@/models/User": userModel,
    "@/lib/auth": { auth: async () => null },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/web-mutation-auth": {
      requireWebMutationSession: async () => ({
        session: { user: { id: "user-1", role: "user", adminId: "admin-1" } },
      }),
    },
  }, async ({ POST }) => {
    const req = new Request("http://localhost/api/user/minute-request", {
      method: "POST",
      body: JSON.stringify({ minutes: 15 }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.equal(createdRequest.userId, "user-1");
    assert.equal(createdRequest.adminId, "admin-1");
    assert.equal(createdRequest.minutes, 15);
    assert.equal(createdRequest.status, "pending");
  });
});
