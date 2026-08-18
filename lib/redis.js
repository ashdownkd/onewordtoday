import { Redis } from "@upstash/redis";

// Redis.fromEnv() reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN,
// and falls back to KV_REST_API_URL / KV_REST_API_TOKEN — the names the
// Vercel Marketplace "Upstash for Redis" integration injects automatically.
// Either naming works with no extra config.
export const redis = Redis.fromEnv();
