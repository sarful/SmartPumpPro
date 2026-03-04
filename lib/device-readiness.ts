type DeviceState = {
  deviceReady?: boolean | null;
  deviceLastSeenAt?: Date | string | null;
};

// ESP32 polls every 5s, so >15s means device is stale/offline.
export const DEVICE_HEARTBEAT_TIMEOUT_MS = 15_000;

export function isDeviceOnline(deviceLastSeenAt?: Date | string | null): boolean {
  if (!deviceLastSeenAt) return false;
  const ts = new Date(deviceLastSeenAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= DEVICE_HEARTBEAT_TIMEOUT_MS;
}

export function isDeviceReadyEffective(state?: DeviceState | null): boolean {
  if (!state) return false;
  return Boolean(state.deviceReady) && isDeviceOnline(state.deviceLastSeenAt ?? null);
}

