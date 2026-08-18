import { redis } from "@/lib/redis";

const WINDOW_SECONDS = 20; // one submission per IP per 20s

// Returns true if this IP may submit right now, false if it's too soon
// since their last one. Can't rate-limit an IP we don't have, so those
// are allowed through (geolocation will just fall back to default).
export async function allowSubmission(ip) {
  if (!ip) return true;
  const key = `owt:rl:${ip}`;
  const existing = await redis.get(key);
  if (existing) return false;
  await redis.set(key, "1", { ex: WINDOW_SECONDS });
  return true;
}
