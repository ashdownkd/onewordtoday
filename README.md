# One Word Today

A live world map. Type one word describing your day — it appears as a
blinking point near your location, alongside everyone else's.

## Stack
- **Next.js 14** (App Router) — free, deploys natively on Vercel
- **d3-geo + topojson-client** — real world map geometry (Natural Earth data via `world-atlas`, loaded from a free public CDN)
- **d3-zoom + d3-selection** — scroll/pinch to zoom, drag to pan
- **@upstash/redis** — free serverless Redis, connected via the Vercel Marketplace, for storing submissions (persists across all visitors)
- **ip-api.com** — free IP → lat/lng geolocation, no key needed, called server-side

## What's new in this pass
- Map is now zoomable/pannable (scroll wheel, pinch, drag)
- Each landmass is colored by continent via a radial gradient
  (`lib/continents.js` for the palette, `lib/countryData.js` for the
  ISO code → continent lookup) instead of a flat fill
- Ocean, sea, and continent name labels (`lib/labels.js`)
- Hovering a country shows its name (native SVG `<title>` tooltip)
- Fixed a layout bug where the tagline and word count overlapped in
  the top right on smaller screens
- Added an intro gate screen (`app/components/Splash.js`) — title,
  the day's question, "press enter to continue" — before the map loads
- Added per-IP rate limiting (one submission per 20s, `lib/rateLimit.js`)
  so the public site can't be spammed
- Input is sanitized server-side to letters/numbers/apostrophes/hyphens
  only, so stray characters can't break the layout
- Added a favicon, Open Graph tags for link previews, a `robots.txt`,
  and a loading state while the map geometry fetches
- **Fixed storage:** Vercel KV (`@vercel/kv`) is fully discontinued —
  switched to `@upstash/redis` via the Vercel Marketplace integration
  (see step 2 below, this replaces the old "Storage → KV" instructions)

## Map quality pass
- Switched from 110m to **50m resolution** map data — real coastline
  and border detail instead of a simplified silhouette
- **Country name labels**, not just continents — the ~15 largest
  nations show even fully zoomed out; more reveal themselves as you
  zoom in (tune the constants in `page.js`'s `labelThreshold` line
  if you want labels to appear sooner/later)
- Labels and point markers now stay a **constant screen size** at any
  zoom level (each is wrapped in a `scale(1/k)` counter-transform) —
  before this they'd balloon to unreadable sizes when zoomed in
- All labels have a dark halo (`paint-order: stroke fill`) so they
  stay legible over any color of land or sea
- Continent labels fade out smoothly as you zoom past ~2x, handing
  off to country labels — same handoff you'd see in a real map app
- Richer, more saturated continent gradients + a subtle drop-shadow
  filter on the landmasses for a "lifted off the ocean" depth effect
- On-screen **zoom controls** (+/−/reset) bottom-right, in addition to
  scroll/pinch/drag
- Deepened the zoom range (1x–24x) so there's room to actually explore
  down to country level

## Redesign pass (monochrome, matching the reference look)
- Replaced the rainbow per-continent gradients with a **restrained
  monochrome steel-blue palette** (`lib/continents.js`) — a few subtle
  variants for texture, not a different color per continent. Color is
  reserved for the word points, not the base terrain.
- **Removed the big "AFRICA" / "EUROPE" continent labels** — they were
  colliding with country names at the default zoom level (the
  "EUROPE"/country-name overlap bug). Country names alone read much
  cleaner and match the reference image.
- Labels switched from bold italic serif to **thin, small, uppercase
  sans-serif** (`Space Grotesk`) — quieter and more map-like.
- Softened the graticule grid and land drop-shadow so the base map
  recedes and the glowing word points are what draws the eye.

## Fixing "Couldn't send" after connecting the database
Connecting a database in Vercel's Storage tab does **not** retroactively
inject env vars into a deployment that's already running — only new
deployments pick them up. If you see "Couldn't send" right after
connecting Upstash: go to **Deployments** → latest deployment → **⋯** →
**Redeploy**. If it still fails after that, open that deployment's
**Runtime Logs**, find the failed `/api/words` request, and check the
actual server error there — `lib/redis.js` already matches Upstash's
official `Redis.fromEnv()` example for this integration, so a fresh
redeploy resolves it in the vast majority of cases.

Nothing here requires a paid plan. Vercel KV and Vercel hosting both have
generous free tiers that easily cover a small/medium project.

## Local setup

```bash
npm install
npm run dev
```

Visit http://localhost:3000. Note: without a KV database connected,
submissions will fail — see step 2 below. Localhost IP also won't
geolocate (falls back to a default point), so location testing is best
done after deploying.

## Deploy to Vercel with onewordtoday.live

**1. Push this project to a GitHub repo, then import it in Vercel**
(vercel.com → Add New → Project → import your repo).

**2. Add a free Redis database (via Vercel Marketplace)**
Vercel KV was discontinued, so this now goes through the Marketplace:
in your Vercel project → **Storage** tab → **Browse Marketplace** (or
**Create Database**) → search **"Upstash"** → install **Upstash for
Redis** (the free tier needs no credit card) → connect it to this
project. Vercel injects the required environment variables
automatically — either `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
or `KV_REST_API_URL`/`KV_REST_API_TOKEN` depending on integration
version; `lib/redis.js` reads either, so no manual copying needed.

**3. Connect your domain**
Vercel project → Settings → Domains → add `onewordtoday.live`. Vercel will
show you the DNS records (usually an A record + CNAME) to add at your
domain registrar. Propagation is usually minutes to a few hours.

**4. Redeploy**
After adding the Redis integration, trigger a redeploy (Vercel does this
automatically on the next git push, or click Redeploy in the dashboard).

That's it — `onewordtoday.live` will be live with real persistence.

## Mobile/tablet fix
The map previously used a fixed landscape-shaped coordinate box, which
got letterboxed into a tiny centered strip on tall phone screens. The
projection now measures its actual container via `ResizeObserver` and
refits itself — full-bleed on any screen size/orientation, phone,
tablet, or desktop. Also switched `100vh` to `100dvh` (with a `100vh`
fallback) since mobile browsers include the address-bar area in `100vh`,
which was clipping content at the bottom on some devices.

## State/province labels
Zoom in (or tap +) past a threshold and state/province names appear on
top of the country layer, for a curated set of major countries covering
every populated continent (`lib/stateData.js` — 374 entries across 17
countries, hand-verified). This is **name labels only, not boundary
outlines** — see below for why, and how to extend it.

**Why not full state/district boundary polygons, or full global
coverage:** the realistic public sources for this (geoBoundaries /
Natural Earth admin-1 and admin-2 data) are either stored via Git LFS —
which breaks silently when fetched through a CDN like jsdelivr, serving
a tiny pointer file instead of the real shape — or sit behind a
metadata API that rate-limited during testing. Shipping a data
dependency I can't verify works is exactly what caused the earlier
storage bug, so this was left out rather than risk repeating that.
District/county-level data globally is also just very large (tens of
thousands of polygons) — not a good fit for a decorative background map
loaded client-side.

**To extend country coverage:** add another entry to `STATE_INFO` in
`lib/stateData.js`, same shape: `CountryName: [[name, lat, lng], ...]`.
**To eventually add real boundary outlines:** the more robust path is a
server-side proxy — a Next.js API route that fetches and caches
geoBoundaries data on your own infrastructure (sidesteps both the LFS
and rate-limit issues) — rather than the client fetching a third party
directly. Happy to help build that out if/when you want to invest in it.

## Label readability + zoom smoothness
- Country/state/sea labels were rendering too small to read — bumped
  font sizes up meaningfully and strengthened the dark halo behind
  each one (`app/globals.css`).
- Found the actual cause of choppy zoom: every zoom/pan frame was
  re-running the full map projection for all ~250 country shapes and
  every label, because that work was happening inline during render.
  All of it is now precomputed in `useMemo` blocks tied to the map
  data and container size — a zoom/pan gesture now only updates one
  CSS transform, which is what the browser is actually fast at.
  Added `will-change: transform` on that layer too.

## Click a word for details
Every point on the map is now clickable (bigger invisible hit-area
than the visible dot, so it's easy to tap on mobile). It opens a card
showing the word, and whatever location detail is actually available
for that submission: city, state (now pulled from the same IP lookup
via ip-api's `regionName` field), country with its flag, and district
**when ip-api's `district` field happens to be populated** — most IPs
worldwide only resolve to city-level, so this will often be blank, and
the card simply omits that row rather than showing something fake.

## How it works, short version

- User types a word → POSTs to `/api/words`
- Server reads their IP from request headers → looks up approximate
  lat/lng via ip-api.com → picks a color via a simple keyword mood
  lookup (`lib/mood.js`) → stores `{word, lat, lng, color, timestamp}`
  in a Redis list via `lib/redis.js`
- Frontend polls `/api/words` every 5 seconds, re-renders all points
  whose timestamp is within the last 24 hours (older ones are filtered
  out both server- and client-side)
- The world map itself is real country geometry — not a drawing —
  projected with `d3-geo`'s Natural Earth projection

## Swapping in real GPS location later

Right now every submission is geolocated by IP (fast, no permission
prompt, good enough for city-level accuracy). If you want to ask users
for precise GPS location instead:

1. In `app/page.js`, before POSTing, call
   `navigator.geolocation.getCurrentPosition()` and send `lat`/`lng` in
   the request body.
2. In `app/api/words/route.js`, use the client-sent `lat`/`lng` instead
   of calling `ipToLocation()` when present.

## Known limits (free tier)
- `ip-api.com` free tier: 45 requests/minute — plenty for a small/medium
  site, would need a paid key only at high scale
- Upstash Redis free tier: 500K commands/month — fine for this use case
  since old words are trimmed automatically and each submission is only
  a few commands
