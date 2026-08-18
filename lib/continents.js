// Jewel-toned palette, one per continent, kept dark/muted enough to
// stay night-map elegant rather than a bright political map. Each has
// a lighter "light" stop and a darker "base" stop for a radial
// gradient (simulating a light source, upper-left), plus a "stroke"
// for its border color.
export const CONTINENT_COLORS = {
  Africa: { light: "#E2A374", base: "#8B4A28", stroke: "#7A4527" },
  Asia: { light: "#6FBBA8", base: "#285850", stroke: "#1F4A42" },
  Europe: { light: "#B08DB9", base: "#4F3856", stroke: "#46324B" },
  "North America": { light: "#6FA8CC", base: "#24435A", stroke: "#1E3548" },
  "South America": { light: "#9CC178", base: "#445A28", stroke: "#384A26" },
  Oceania: { light: "#F0CC8E", base: "#96721F", stroke: "#7A5A26" },
  Antarctica: { light: "#7C8DA3", base: "#333D4C", stroke: "#2A313D" },
  Unknown: { light: "#5A6578", base: "#242A34", stroke: "#1F242E" },
};

export function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}
