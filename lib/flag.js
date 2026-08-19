// ISO 3166-1 alpha-2 code -> flag emoji, via Unicode regional
// indicator symbols. No external data/API — always reliable.
export function flagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = [...countryCode.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
