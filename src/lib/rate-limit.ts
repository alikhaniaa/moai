/**
 * Small in-memory rate limiter - enough to stop scripted abuse of the OTP and
 * payment endpoints on a single-server deployment.
 *
 * It intentionally has no external dependency. If the shop ever runs on more
 * than one instance, move this to Redis, since each process keeps its own map.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// keep the map from growing forever
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}, 60_000).unref?.();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }
  b.count++;
  return { ok: b.count <= max, remaining: Math.max(0, max - b.count) };
}

/**
 * Client IP as reported by our own proxy, not by the client.
 *
 * Caddy sets X-Real-Ip to the connecting address (overwriting anything the
 * client sent) and *appends* that address to X-Forwarded-For - so the LAST
 * entry there is proxy-written and the first is attacker-controlled. Reading
 * the first entry would let anyone reset their rate limit per request.
 */
export function clientIp(req: Request) {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  return (
    h.get("x-real-ip") ??
    (xff ? xff.split(",").pop()!.trim() : null) ??
    "unknown"
  );
}
