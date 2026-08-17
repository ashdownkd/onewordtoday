# One Word Today

A live world map. Type one word describing your day — it appears as a
blinking point near your location, alongside everyone else's.

## Stack
- **Next.js 14** (App Router) — free, deploys natively on Vercel
- **d3-geo + topojson-client** — real world map geometry (Natural Earth data via `world-atlas`, loaded from a free public CDN)
- **@vercel/kv** — free Redis database for storing submissions (persists across all visitors)
- **ip-api.com** — free IP → lat/lng geolocation, no key needed, called server-side

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

**2. Add a free KV database**
In your Vercel project → Storage tab → Create Database → KV (Upstash Redis,
free tier). Vercel automatically adds the required environment variables
(`KV_URL`, `KV_REST_API_URL`, etc.) to your project — no manual copying needed.

**3. Connect your domain**
Vercel project → Settings → Domains → add `onewordtoday.live`. Vercel will
show you the DNS records (usually an A record + CNAME) to add at your
domain registrar. Propagation is usually minutes to a few hours.

**4. Redeploy**
After adding the KV database, trigger a redeploy (Vercel does this
automatically on the next git push, or click Redeploy in the dashboard).

That's it — `onewordtoday.live` will be live with real persistence.

## How it works, short version

- User types a word → POSTs to `/api/words`
- Server reads their IP from request headers → looks up approximate
  lat/lng via ip-api.com → picks a color via a simple keyword mood
  lookup (`lib/mood.js`) → stores `{word, lat, lng, color, timestamp}`
  in the KV list
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
- Vercel KV free tier: 30MB storage / 3,000 commands per day on the
  Hobby plan — fine for this use case since old words are trimmed
  automatically
