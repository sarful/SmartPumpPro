type Bucket = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetInMs: windowMs };
  }

  if (existing.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: Math.max(existing.resetAt - now, 0),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(max - existing.count, 0),
    resetInMs: Math.max(existing.resetAt - now, 0),
  };
}
