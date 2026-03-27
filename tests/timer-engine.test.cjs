const test = require("node:test");
const assert = require("node:assert/strict");
const { withModuleMocks } = require("./helpers/module-mocks.cjs");

test("calculateUsedMinutes floors elapsed runtime and caps at set minutes", async () => {
  await withModuleMocks("@/lib/timer-engine.ts", {
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/models/User": {},
    "@/models/Queue": {},
    "@/lib/queue-engine": { startNextUser: async () => null },
    "@/models/Admin": {},
    "@/lib/card-mode": {
      finalizeCardModeSession: async () => {},
    },
  }, async ({ calculateUsedMinutes }) => {
    const sixMinutesAgo = new Date(Date.now() - 6.8 * 60 * 1000);
    assert.equal(calculateUsedMinutes(sixMinutesAgo, 10), 6);
  });
});

test("calculateUsedMinutes never exceeds the originally set minutes", async () => {
  await withModuleMocks("@/lib/timer-engine.ts", {
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/models/User": {},
    "@/models/Queue": {},
    "@/lib/queue-engine": { startNextUser: async () => null },
    "@/models/Admin": {},
    "@/lib/card-mode": {
      finalizeCardModeSession: async () => {},
    },
  }, async ({ calculateUsedMinutes }) => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    assert.equal(calculateUsedMinutes(twentyMinutesAgo, 7), 7);
  });
});

test("calculateUsedMinutes returns zero for missing start time or invalid minutes", async () => {
  await withModuleMocks("@/lib/timer-engine.ts", {
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/models/User": {},
    "@/models/Queue": {},
    "@/lib/queue-engine": { startNextUser: async () => null },
    "@/models/Admin": {},
    "@/lib/card-mode": {
      finalizeCardModeSession: async () => {},
    },
  }, async ({ calculateUsedMinutes }) => {
    assert.equal(calculateUsedMinutes(null, 10), 0);
    assert.equal(calculateUsedMinutes(new Date(), 0), 0);
  });
});
