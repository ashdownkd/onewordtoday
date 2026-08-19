// Free IP geolocation, no API key needed. Runs server-side only
// (avoids browser mixed-content issues, and avoids asking for
// GPS permission from every visitor).
//
// district is a real field ip-api.com provides, but it's only
// populated for a minority of IPs (most resolve to city-level, not
// neighborhood-level, industry-wide) — treat it as "sometimes there",
// not guaranteed, and never show a placeholder when it's empty.

export async function ipToLocation(ip) {
  const fallback = { lat: 20, lng: 0, city: "", region: "", country: "", countryCode: "", district: "" };

  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.")) {
    return fallback;
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,regionName,country,countryCode,district`
    );
    const data = await res.json();
    if (data.status === "success") {
      return {
        lat: data.lat,
        lng: data.lon,
        city: data.city || "",
        region: data.regionName || "",
        country: data.country || "",
        countryCode: data.countryCode || "",
        district: data.district || "",
      };
    }
  } catch (e) {
    // swallow — fall back below
  }
  return fallback;
}
