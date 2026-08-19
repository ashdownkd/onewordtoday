import { redis } from "@/lib/redis";
import { ipToLocation } from "@/lib/geo";
import { moodColor } from "@/lib/mood";
import { allowSubmission } from "@/lib/rateLimit";

const LIST_KEY = "owt:words";
const MAX_STORED = 500;
const WINDOW_MS = 24 * 60 * 60 * 1000; // words fade after 24h

export async function GET() {
  const raw = await redis.lrange(LIST_KEY, 0, MAX_STORED - 1);
  const now = Date.now();
  const words = raw
    .map((entry) => (typeof entry === "string" ? JSON.parse(entry) : entry))
    .filter((w) => now - w.ts < WINDOW_MS);

  return Response.json({ words, count: words.length });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const raw = (body.word || "").trim().split(/\s+/)[0] || "";

  // Keep letters (any language), numbers, apostrophes, hyphens only —
  // strips anything that could break layout or isn't really "a word".
  const word = raw.normalize("NFC").replace(/[^\p{L}\p{N}'-]/gu, "");

  if (!word || word.length > 24) {
    return Response.json({ error: "Send a single word, 24 characters or less." }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "";

  const allowed = await allowSubmission(ip);
  if (!allowed) {
    return Response.json(
      { error: "One word at a time — try again in a few seconds." },
      { status: 429 }
    );
  }

  const loc = await ipToLocation(ip);

  const entry = {
    word,
    lat: loc.lat,
    lng: loc.lng,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    countryCode: loc.countryCode,
    district: loc.district,
    color: moodColor(word),
    ts: Date.now(),
  };

  await redis.lpush(LIST_KEY, JSON.stringify(entry));
  await redis.ltrim(LIST_KEY, 0, MAX_STORED - 1);

  return Response.json({ ok: true, entry });
}
