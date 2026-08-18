"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import { feature } from "topojson-client";
import Splash from "./components/Splash";
import { COUNTRY_INFO } from "@/lib/countryData";
import { LAND_GRADIENTS, LAND_STROKE } from "@/lib/continents";
import { OCEAN_LABELS } from "@/lib/labels";
import { STATE_INFO } from "@/lib/stateData";

// 50m resolution: real coastline and border detail, not a simplified
// silhouette. Bigger download than the 110m set but still free/CDN'd.
const WORLD_TOPOJSON_URL = "https://unpkg.com/world-atlas@2/countries-50m.json";

// Fallback box before the container has been measured — real sizing
// takes over immediately via ResizeObserver below.
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 520;

// How many country labels can be on screen at once, max — keeps very
// high zoom from turning into a wall of text.
const MAX_COUNTRY_LABELS = 140;

// Zoom level past which state/province name labels start appearing.
const STATE_LABEL_MIN_ZOOM = 5;

export default function Page() {
  const [entered, setEntered] = useState(false);
  const [land, setLand] = useState(null);
  const [words, setWords] = useState([]);
  const [count, setCount] = useState(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [transform, setTransform] = useState(zoomIdentity);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const projectionRef = useRef(null);
  const zoomBehaviorRef = useRef(null);

  function setupProjection(width, height) {
    const projection = geoNaturalEarth1().fitSize([width, height], { type: "Sphere" });
    projectionRef.current = projection;
    pathRef.current = geoPath(projection);
  }

  // Fetch the world map geometry once.
  useEffect(() => {
    fetch(WORLD_TOPOJSON_URL)
      .then((r) => r.json())
      .then((topo) => {
        const countries = feature(topo, topo.objects.countries);
        setLand(countries);
      })
      .catch(() => setError("Couldn't load map data — check your connection."));
  }, []);

  // Fit the projection to the ACTUAL container size, and keep it fit
  // as the viewport changes (rotate, resize, mobile browser chrome
  // showing/hiding). This is what fixes the map being squashed into a
  // tiny letterboxed strip on tall phone screens.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    let debounceId;

    function measure() {
      const rect = el.getBoundingClientRect();
      const w = Math.max(200, Math.round(rect.width));
      const h = Math.max(200, Math.round(rect.height));
      setupProjection(w, h);
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    }

    measure();
    const ro = new ResizeObserver(() => {
      clearTimeout(debounceId);
      debounceId = setTimeout(measure, 150);
    });
    ro.observe(el);
    return () => {
      clearTimeout(debounceId);
      ro.disconnect();
    };
  }, []);

  // Precompute per-country name/area/centroid whenever the map data OR
  // the projection size changes — must recompute on resize since area/
  // centroid are derived from the current projection.
  const countryFeatures = useMemo(() => {
    if (!land || !pathRef.current) return [];
    return land.features.map((f) => {
      const info = COUNTRY_INFO[Number(f.id)];
      const name = info ? info[0] : null;
      const area = pathRef.current.area(f);
      const centroid = pathRef.current.centroid(f);
      return { f, name, area, centroid };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [land, size.width, size.height]);

  // Zoom + pan: wheel to zoom, drag to pan, pinch on touch. Recreated
  // whenever the container size changes, since translateExtent is
  // sized to it — resets pan/zoom on resize so an old transform can't
  // end up mismatched with a new coordinate space.
  useEffect(() => {
    if (!svgRef.current) return;
    const zoomBehavior = d3zoom()
      .scaleExtent([1, 24])
      .translateExtent([
        [-size.width * 0.5, -size.height * 0.5],
        [size.width * 1.5, size.height * 1.5],
      ])
      .on("zoom", (event) => setTransform(event.transform));

    zoomBehaviorRef.current = zoomBehavior;
    const sel = select(svgRef.current);
    sel.call(zoomBehavior);
    sel.call(zoomBehavior.transform, zoomIdentity);
    return () => sel.on(".zoom", null);
  }, [size.width, size.height]);

  function zoomBy(factor) {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current).transition().duration(280).call(zoomBehaviorRef.current.scaleBy, factor);
  }

  function resetView() {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current)
      .transition()
      .duration(400)
      .call(zoomBehaviorRef.current.transform, zoomIdentity);
  }

  const fetchWords = useCallback(async () => {
    try {
      const res = await fetch("/api/words", { cache: "no-store" });
      const data = await res.json();
      setWords(data.words || []);
      setCount(data.count || 0);
    } catch {
      // silent — next poll will retry
    }
  }, []);

  useEffect(() => {
    fetchWords();
    const id = setInterval(fetchWords, 5000);
    return () => clearInterval(id);
  }, [fetchWords]);

  async function submitWord(e) {
    e.preventDefault();
    const word = input.trim();
    if (!word) return;
    if (/\s/.test(word)) {
      setError("Just one word.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong.");
      } else {
        setInput("");
        fetchWords();
      }
    } catch {
      setError("Couldn't send — try again.");
    } finally {
      setSending(false);
    }
  }

  const graticule = geoGraticule10();
  const projection = projectionRef.current;
  const k = transform.k;
  const inverseScale = 1 / k;

  // More countries reveal themselves as you zoom in — the biggest
  // ~15 nations are visible even fully zoomed out, and smaller ones
  // join in as their screen size becomes meaningful. Tune the 1400
  // and 1.55 constants to taste if labels feel too sparse/crowded.
  const labelThreshold = 1400 / Math.pow(k, 1.55);
  const visibleCountryLabels = countryFeatures
    .filter((c) => c.name && c.area > labelThreshold)
    .sort((a, b) => b.area - a.area)
    .slice(0, MAX_COUNTRY_LABELS);

  const showStateLabels = k >= STATE_LABEL_MIN_ZOOM && projection;

  return (
    <div className="canvas">
      {!entered && <Splash onEnter={() => setEntered(true)} />}

      <header className="owt-header">
        <div className="logo">
          one word<em>today</em>
        </div>
        <div className="header-right">
          <div className="prompt-tag">a living atlas of today&rsquo;s words</div>
          <div className="count-badge">
            <b>{count}</b> words today
          </div>
        </div>
      </header>

      <div className="legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: "#F2A65A" }} /> warm / good
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: "#5B8AA6" }} /> heavy / hard
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: "#C9C4B8" }} /> neutral
        </div>
      </div>

      <div className="zoom-controls">
        <button onClick={() => zoomBy(1.6)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">−</button>
        <button onClick={resetView} aria-label="Reset view" className="zoom-reset">⤾</button>
      </div>

      <div className="map-wrap" ref={containerRef}>
        {!land && <div className="map-loading">loading the world…</div>}
        <svg
          ref={svgRef}
          id="map"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="World map with live word submissions"
        >
          <defs>
            {LAND_GRADIENTS.map((c, i) => (
              <radialGradient key={i} id={`grad-${i}`} cx="32%" cy="26%" r="90%">
                <stop offset="0%" stopColor={c.light} stopOpacity="1" />
                <stop offset="100%" stopColor={c.base} stopOpacity="0.97" />
              </radialGradient>
            ))}
            <filter id="land-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#000000" floodOpacity="0.35" />
            </filter>
          </defs>

          <g transform={transform.toString()}>
            {pathRef.current && (
              <path className="graticule" d={pathRef.current(graticule)} vectorEffect="non-scaling-stroke" />
            )}

            <g filter="url(#land-shadow)">
              {pathRef.current &&
                countryFeatures.map(({ f, name }, i) => (
                  <path
                    key={i}
                    className="land"
                    d={pathRef.current(f)}
                    style={{
                      fill: `url(#grad-${i % LAND_GRADIENTS.length})`,
                      stroke: LAND_STROKE,
                      strokeWidth: 0.5,
                    }}
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>{name || "Unknown territory"}</title>
                  </path>
                ))}
            </g>

            {projection &&
              OCEAN_LABELS.map((o, i) => {
                const p = projection([o.lng, o.lat]);
                if (!p) return null;
                return (
                  <g key={`sea-${i}`} transform={`translate(${p[0]},${p[1]}) scale(${inverseScale})`}>
                    <text className="sea-label" textAnchor="middle">{o.name}</text>
                  </g>
                );
              })}

            {visibleCountryLabels.map(({ f, name, centroid }) => (
              <g
                key={`country-${f.id}`}
                transform={`translate(${centroid[0]},${centroid[1]}) scale(${inverseScale})`}
              >
                <text className="country-label" textAnchor="middle">{name}</text>
              </g>
            ))}

            {showStateLabels &&
              Object.entries(STATE_INFO).flatMap(([countryName, states]) =>
                states.map(([name, lat, lng], idx) => {
                  const p = projection([lng, lat]);
                  if (!p) return null;
                  return (
                    <g
                      key={`state-${countryName}-${idx}`}
                      transform={`translate(${p[0]},${p[1]}) scale(${inverseScale})`}
                    >
                      <text className="state-label" textAnchor="middle">{name}</text>
                    </g>
                  );
                })
              )}

            {projection &&
              words.map((w, i) => {
                const p = projection([w.lng, w.lat]);
                if (!p) return null;
                const [x, y] = p;
                const delay = `${(i % 12) * 0.2}s`;
                return (
                  <g key={`${w.ts}-${i}`} transform={`translate(${x},${y}) scale(${inverseScale})`}>
                    <circle
                      className="point-ring"
                      r="3"
                      stroke={w.color}
                      style={{ animationDelay: delay }}
                    />
                    <circle
                      className="point-core"
                      r="2.5"
                      fill={w.color}
                      style={{ animationDelay: delay, filter: `drop-shadow(0 0 4px ${w.color})` }}
                    />
                    <text className="word-label" x="6" y="-3" style={{ animationDelay: delay }}>
                      {w.word}
                    </text>
                  </g>
                );
              })}
          </g>
        </svg>
      </div>

      <form className="input-dock" onSubmit={submitWord}>
        <div className="pill">
          <input
            type="text"
            placeholder="type your word…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={24}
            aria-label="Your one word for today"
          />
          <button className="send-btn" type="submit" disabled={sending} aria-label="Submit word">
            ↑
          </button>
        </div>
      </form>
      {error && <div className="toast">{error}</div>}
      <div className="caption">your point appears near your location · scroll or pinch to zoom</div>
    </div>
  );
}
