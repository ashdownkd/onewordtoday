import { kv } from "@vercel/kv";
import { ipToLocation } from "@/lib/geo";
import { moodColor } from "@/lib/mood";

const LIST_KEY = "owt:words";
const MAX_STORED = 500;
const WINDOW_MS = 24 * 60 * 60 * 1000; // words fade after 24h

export async function GET() {
  const raw = await kv.lrange(LIST_KEY, 0, MAX_STORED - 1);
  const now = Date.now();
  const words = raw
    .map((entry) => (typeof entry === "string" ? JSON.parse(entry) : entry))
    .filter((w) => now - w.ts < WINDOW_MS);

  return Response.json({ words, count: words.length });
}

export async function POST(req) {
  const body = await req.json();
  const word = (body.word || "").trim().split(/\s+/)[0]; // enforce one word

  if (!word || word.length > 24) {
    return Response.json({ error: "Send a single word, 24 characters or less." }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "";

  const loc = await ipToLocation(ip);

  const entry = {
    word,
    lat: loc.lat,
    lng: loc.lng,
    city: loc.city,
    country: loc.country,
    color: moodColor(word),
    ts: Date.now(),
  };

  await kv.lpush(LIST_KEY, JSON.stringify(entry));
  await kv.ltrim(LIST_KEY, 0, MAX_STORED - 1);

  return Response.json({ ok: true, entry });
}
