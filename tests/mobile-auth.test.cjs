const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
  hashRefreshToken,
} = require("@/lib/mobile-auth");

test("mobile access tokens round-trip with session id", () => {
  process.env.MOBILE_JWT_SECRET = "12345678901234567890123456789012";

  const token = createAccessToken({
    sub: "user-1",
    sid: "session-1",
    role: "user",
    username: "alice",
    adminId: "admin-1",
  });

  const payload = verifyAccessToken(token);
  assert.ok(payload);
  assert.equal(payload.sub, "user-1");
  assert.equal(payload.sid, "session-1");
  assert.equal(payload.role, "user");
});

test("tampered mobile access token is rejected", () => {
  process.env.MOBILE_JWT_SECRET = "12345678901234567890123456789012";

  const token = createAccessToken({
    sub: "user-1",
    sid: "session-1",
    role: "user",
    username: "alice",
    adminId: "admin-1",
  });

  const tampered = `${token.slice(0, -1)}x`;
  assert.equal(verifyAccessToken(tampered), null);
});

test("refresh token hashes are deterministic for the same token", () => {
  const token = createRefreshToken();
  assert.equal(hashRefreshToken(token), hashRefreshToken(token));
});
