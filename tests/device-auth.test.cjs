const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isAuthorizedDeviceRequest,
  isDeviceSecretConfigured,
  getDeviceSecretHeaderName,
} = require("@/lib/device-auth");

test("device auth accepts matching device secret header", () => {
  process.env.ESP32_DEVICE_SECRET = "pump-secret";
  const req = new Request("http://localhost/api/esp32/poll", {
    headers: {
      [getDeviceSecretHeaderName()]: "pump-secret",
    },
  });

  assert.equal(isDeviceSecretConfigured(), true);
  assert.equal(isAuthorizedDeviceRequest(req), true);
});

test("device auth rejects missing or incorrect device secret header", () => {
  process.env.ESP32_DEVICE_SECRET = "pump-secret";
  const req = new Request("http://localhost/api/esp32/poll", {
    headers: {
      [getDeviceSecretHeaderName()]: "wrong-secret",
    },
  });

  assert.equal(isAuthorizedDeviceRequest(req), false);
});
