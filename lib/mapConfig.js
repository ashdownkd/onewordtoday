// Kept separate from MapView.js on purpose: MapView.js imports
// maplibre-gl at the top of the file, which is not safe to touch
// during server-side rendering. Anything page.js needs from the map
// config has to live somewhere that doesn't pull that import in.
export const INITIAL_CENTER = [12, 22];
export const INITIAL_ZOOM = 1.6;
