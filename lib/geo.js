// Free IP geolocation, no API key needed. Runs server-side only
// (avoids browser mixed-content issues, and avoids asking for
// GPS permission from every visitor).
//
// Swap-in note: to use real browser GPS instead later, replace the
// call site in app/api/words/route.js with lat/lng sent from the
// client via navigator.geolocation.getCurrentPosition().

export async function ipToLocation(ip) {
  // Fallback default (mid-Atlantic) if lookup fails or IP is local/dev
  const fallback = { lat: 20, lng: 0, city: "Unknown", country: "Unknown" };

  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.")) {
    return fallback;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon,city,country`);
    const data = await res.json();
    if (data.status === "success") {
      return { lat: data.lat, lng: data.lon, city: data.city, country: data.country };
    }
  } catch (e) {
    // swallow — fall back below
  }
  return fallback;
}
