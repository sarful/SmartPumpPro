const test = require("node:test");
const assert = require("node:assert/strict");
const { withModuleMocks } = require("./helpers/module-mocks.cjs");

test("web mutation auth blocks suspended users", async () => {
  const userModel = {
    findById: () => ({
      select: () => ({
        lean: async () => ({
          status: "suspended",
          suspendReason: "Suspended for billing review",
          adminId: "admin-1",
        }),
      }),
    }),
  };

  await withModuleMocks("@/lib/web-mutation-auth.ts", {
    "@/lib/auth": {
      auth: async () => ({
        user: { id: "user-1", role: "user", adminId: "admin-1" },
      }),
    },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/models/User": userModel,
    "@/models/Admin": { findById: () => ({ select: () => ({ lean: async () => null }) }) },
  }, async ({ requireWebMutationSession }) => {
    const result = await requireWebMutationSession(["user"]);
    assert.ok(result.response);
    assert.equal(result.response.status, 403);
    assert.deepEqual(await result.response.json(), {
      error: "Suspended for billing review",
    });
  });
});

test("web mutation auth blocks inactive admins", async () => {
  const adminModel = {
    findById: () => ({
      select: () => ({
        lean: async () => ({
          status: "suspended",
          suspendReason: "Admin disabled by master",
        }),
      }),
    }),
  };

  await withModuleMocks("@/lib/web-mutation-auth.ts", {
    "@/lib/auth": {
      auth: async () => ({
        user: { id: "admin-1", role: "admin", adminId: "admin-1" },
      }),
    },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/models/Admin": adminModel,
    "@/models/User": { findById: () => ({ select: () => ({ lean: async () => null }) }) },
  }, async ({ requireWebMutationSession }) => {
    const result = await requireWebMutationSession(["admin"]);
    assert.ok(result.response);
    assert.equal(result.response.status, 403);
    assert.deepEqual(await result.response.json(), {
      error: "Admin disabled by master",
    });
  });
});
