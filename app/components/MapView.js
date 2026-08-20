"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

// OpenFreeMap: free, unlimited, no API key, MIT-licensed vector tiles
// built on OpenStreetMap data. "dark" is one of their built-in styles.
// Attribution is required by their terms — kept via AttributionControl
// below, just repositioned/compacted rather than removed.
export const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
export const INITIAL_CENTER = [12, 22];
export const INITIAL_ZOOM = 1.6;

export default function MapView({ words, onSelectWord, onReady }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const onSelectWordRef = useRef(onSelectWord);
  onSelectWordRef.current = onSelectWord;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!maplibregl.supported()) {
      onReady?.(null, "unsupported");
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 1.2,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    map.on("load", () => onReady?.(map, "ready"));

    mapRef.current = map;

    function handleResize() {
      map.resize();
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync word markers whenever the word list updates. Recreating them
  // each poll is cheap at this scale (tens/hundreds of DOM nodes every
  // 5s, not per animation frame — nothing like the old SVG cost).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    words.forEach((w, i) => {
      if (typeof w.lng !== "number" || typeof w.lat !== "number") return;

      const el = document.createElement("div");
      el.className = "word-marker";
      el.style.setProperty("--mood-color", w.color || "#C9C4B8");

      const ring = document.createElement("div");
      ring.className = "word-marker-ring";
      const core = document.createElement("div");
      core.className = "word-marker-core";
      const label = document.createElement("div");
      label.className = "word-marker-label";
      label.textContent = w.word;

      const delay = `${(i % 12) * 0.2}s`;
      ring.style.animationDelay = delay;
      core.style.animationDelay = delay;
      label.style.animationDelay = delay;

      el.append(ring, core, label);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectWordRef.current?.(w);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([w.lng, w.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [words]);

  return <div ref={containerRef} className="maplibre-map" />;
}
