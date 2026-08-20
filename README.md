# One Word Today

A live world map. Type one word describing your day — it appears as a
blinking point near your location, alongside everyone else's. Click any
point to see its word, city, state, country (with flag), and district
when that detail happens to be available.

## Stack
- **Next.js 14** (App Router) — free, deploys natively on Vercel
- **MapLibre GL JS** — free, open-source (MIT) WebGL map renderer, the
  community fork of Mapbox GL JS from before Mapbox went proprietary
- **OpenFreeMap** (`tiles.openfreemap.org/styles/dark`) — free,
  unlimited, no API key vector tiles built on OpenStreetMap data. This
  is what actually draws the world: real coastlines, borders, and
  place names (country/state/city/district, wherever OSM has them) at
  every zoom level, maintained by the OSM community rather than
  anything hand-authored in this repo
- **@upstash/redis** — free serverless Redis, connected via the Vercel
  Marketplace, for storing submissions (persists across all visitors)
- **ip-api.com** — free IP → lat/lng/city/region/country geolocation,
  no key needed, called server-side

## Why MapLibre (this was originally a hand-built D3/SVG map)
The map used to be custom-drawn: SVG country shapes, hand-authored
label positions, a custom zoom implementation. It looked distinctive
but had a hard ceiling — every zoom/pan frame meant React re-rendering
hundreds of SVG elements, which is exactly what caused the mobile lag.
MapLibre renders via WebGL instead, so panning/zooming is GPU-composited
and doesn't touch React's render tree at all. It also means real,
comprehensive place labels (down to district level, in well-mapped
areas) come from OpenStreetMap directly instead of a curated 17-country
list I was hand-typing in `lib/stateData.js`.

The old D3/SVG files (`lib/continents.js`, `lib/countryData.js`,
`lib/labels.js`, `lib/stateData.js`) are no longer imported anywhere —
left in the repo in case any of that hand-typed data is useful for
something else later, but safe to delete.

**Attribution requirement:** OpenFreeMap's free tier requires
attribution, which MapLibre adds automatically (recolored to fit the
dark theme in `app/globals.css`, bottom-left) — don't remove the
`AttributionControl` in `app/components/MapView.js`, that's what keeps
this compliant with their terms.

**Honest caveat on this rewrite:** I can't run a live WebGL map in my
own environment to test it end-to-end before handing it to you, so
there's a real chance something needs a follow-up fix once you actually
open it — the individual pieces (the OpenFreeMap dark style URL, the
MapLibre marker API, the attribution control) are each verified against
current docs/examples, but I haven't seen them run together. If
anything looks broken, send a screenshot and I'll fix it fast.

## Click a word for details
Every point is a real HTML marker (`maplibregl.Marker`), not a canvas
shape — that's what lets it reuse plain CSS animation (see
`.word-marker` in `globals.css`) instead of animating inside WebGL.
Clicking one opens a card (`app/page.js`) showing whatever location
detail is actually available for that submission: city, state (from
ip-api's `regionName`), country with its flag emoji, and district
**only when ip-api's `district` field happens to be populated** — most
IPs worldwide only resolve to city-level, so this is often blank and
the card just omits that row rather than showing something fake.

## Local setup

```bash
npm install
npm run dev
```

Visit http://localhost:3000. Submitting a word needs the Redis database
connected (see deploy step 2) — without it, submissions will fail.
Localhost IP also won't geolocate (falls back to a default point), so
location testing is best done after deploying.

## Deploy to Vercel with onewordtoday.live

**1. Push this project to a GitHub repo, then import it in Vercel**
(vercel.com → Add New → Project → import your repo).

**2. Add a free Redis database (via Vercel Marketplace)**
Vercel's old native "KV" product was discontinued, so this goes through
the Marketplace now: in your Vercel project → **Storage** tab →
**Browse Marketplace** (or **Create Database**) → search **"Upstash"**
→ install **Upstash for Redis** (free tier, no card needed) → connect
it to this project. Vercel injects the required environment variables
automatically — either `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
or `KV_REST_API_URL`/`KV_REST_API_TOKEN` depending on integration
version; `lib/redis.js` reads either, no manual copying needed.

**3. Connect your domain**
Vercel project → Settings → Domains → add `onewordtoday.live`. Vercel
shows the DNS records to add at your registrar. Propagation is usually
minutes to a few hours.

**4. Redeploy**
Vercel does this automatically on the next git push, or click Redeploy
in the dashboard. **Important:** connecting a database to an *existing*
deployment doesn't retroactively give it the credentials — only a fresh
deployment picks those up. If submissions fail right after connecting
Upstash, this is almost always why: redeploy once more.

That's it — `onewordtoday.live` will be live with real persistence.

## How it works, short version

- User types a word → POSTs to `/api/words`
- Server reads their IP from request headers → looks up lat/lng, city,
  region, country, and (sometimes) district via ip-api.com → picks a
  color via a simple keyword mood lookup (`lib/mood.js`) → stores it
  all as one entry in a Redis list via `lib/redis.js`
- Frontend polls `/api/words` every 5 seconds; `MapView.js` diffs the
  word list against the current markers on the map
- The map itself (terrain, borders, all labels) is OpenFreeMap's vector
  tiles rendered by MapLibre — nothing about the base map is generated
  by this app's code

## Swapping in real GPS location later

Right now every submission is geolocated by IP (fast, no permission
prompt, good enough for city-level accuracy). To ask for precise GPS
instead: in `app/page.js`, call `navigator.geolocation.getCurrentPosition()`
before POSTing and send `lat`/`lng` in the request body; in
`app/api/words/route.js`, use the client-sent `lat`/`lng` instead of
calling `ipToLocation()` when present.

## Known limits (free tier)
- `ip-api.com` free tier: 45 requests/minute — plenty for a small/medium
  site, would need a paid key only at high scale
- Upstash Redis free tier: 500K commands/month — fine here since old
  words are trimmed automatically and each submission is only a few
  commands
- OpenFreeMap's public instance has no hard usage limit, but it's a
  donation-funded project — if this ever gets Hacker-News-front-page
  levels of traffic, consider sponsoring them or self-hosting via their
  Protomaps-style setup (see their GitHub)
- Rate limiting: one submission per IP per 20 seconds (`lib/rateLimit.js`)
- Input is sanitized server-side to letters/numbers/apostrophes/hyphens
  only, one word max 24 characters
