// Jewel-toned palette, one per continent, kept dark/muted enough to
// stay night-map elegant rather than a bright political map.
// Each has a lighter "light" stop and a darker "base" stop for a
// radial gradient, plus a "stroke" for its border color.
export const CONTINENT_COLORS = {
  Africa: { light: "#D89163", base: "#9C5A34", stroke: "#7A4527" },
  Asia: { light: "#5FA696", base: "#2F6358", stroke: "#1F4A42" },
  Europe: { light: "#9C7CA3", base: "#5E4363", stroke: "#46324B" },
  "North America": { light: "#5C93B5", base: "#2C4F66", stroke: "#1E3548" },
  "South America": { light: "#8CAD68", base: "#4C6234", stroke: "#384A26" },
  Oceania: { light: "#E0BD7C", base: "#A67D3D", stroke: "#7A5A26" },
  Antarctica: { light: "#6B7A8F", base: "#3A4453", stroke: "#2A313D" },
  Unknown: { light: "#4A5568", base: "#2C3340", stroke: "#1F242E" },
};

export function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}
