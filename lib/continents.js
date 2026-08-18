// A restrained, monochrome palette for the base map — cool steel-blue
// to near-black, with a few subtle variants for gentle texture instead
// of a different loud hue per continent. Color is reserved for the
// data (the word points), not the terrain underneath it.
export const LAND_GRADIENTS = [
  { light: "#3E5670", base: "#141B26" },
  { light: "#35506A", base: "#121822" },
  { light: "#44607A", base: "#161D28" },
  { light: "#3A5468", base: "#131A24" },
];

export const LAND_STROKE = "rgba(150, 175, 200, 0.28)";

export function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}
