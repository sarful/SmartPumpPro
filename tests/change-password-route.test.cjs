const test = require("node:test");
const assert = require("node:assert/strict");
const { withModuleMocks } = require("./helpers/module-mocks.cjs");

test("change-password route rejects reusing the current password", async () => {
  await withModuleMocks("@/app/api/auth/change-password/route.ts", {
    "@/lib/api-guard": { enforceRateLimit: () => null },
    "@/lib/web-mutation-auth": {
      requireWebMutationSession: async () => ({
        session: { user: { id: "u1", role: "user" } },
      }),
    },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/passwords": {
      findAccountByRoleAndId: async () => ({ password: "stored-hash" }),
      hashPassword: async () => "hashed",
      updateAccountPasswordByRoleAndId: async () => {},
      verifyStoredPassword: async () => true,
    },
    "@/lib/observability": { reportIncident: async () => "req-1" },
  }, async ({ POST }) => {
    const req = new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "same-password",
        newPassword: "same-password",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), {
      error: "New password must be different from current password",
    });
  });
});

test("change-password route updates the password on success", async () => {
  let updated = null;

  await withModuleMocks("@/app/api/auth/change-password/route.ts", {
    "@/lib/api-guard": { enforceRateLimit: () => null },
    "@/lib/web-mutation-auth": {
      requireWebMutationSession: async () => ({
        session: { user: { id: "u1", role: "admin" } },
      }),
    },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/passwords": {
      findAccountByRoleAndId: async () => ({ password: "stored-hash" }),
      hashPassword: async () => "new-hash",
      updateAccountPasswordByRoleAndId: async (role, id, hash) => {
        updated = { role, id, hash };
      },
      verifyStoredPassword: async () => true,
    },
    "@/lib/observability": { reportIncident: async () => "req-1" },
  }, async ({ POST }) => {
    const req = new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "old-password",
        newPassword: "new-password-123",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      success: true,
      message: "Password updated successfully",
    });
    assert.deepEqual(updated, { role: "admin", id: "u1", hash: "new-hash" });
  });
});
