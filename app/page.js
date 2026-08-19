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
import { flagEmoji } from "@/lib/flag";

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

function timeAgo(ts) {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

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
  const [selectedWord, setSelectedWord] = useState(null);

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
  // showing/hiding).
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

  // --- Everything below is geometry that does NOT depend on the zoom
  // transform, only on the map data + container size. Precomputing it
  // here means a zoom/pan gesture only ever updates one CSS transform
  // on a parent <g> — nothing re-projects or re-draws per frame. This
  // is what makes zoom/pan feel smooth instead of janky.

  const countryFeatures = useMemo(() => {
    if (!land || !pathRef.current) return [];
    return land.features.map((f) => {
      const info = COUNTRY_INFO[Number(f.id)];
      const name = info ? info[0] : null;
      const area = pathRef.current.area(f);
      const centroid = pathRef.current.centroid(f);
      const d = pathRef.current(f);
      return { f, name, area, centroid, d };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [land, size.width, size.height]);

  const graticuleD = useMemo(() => {
    if (!pathRef.current) return null;
    return pathRef.current(geoGraticule10());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, land]);

  const projectedOceanLabels = useMemo(() => {
    if (!projectionRef.current) return [];
    return OCEAN_LABELS.map((o) => {
      const p = projectionRef.current([o.lng, o.lat]);
      return p ? { name: o.name, x: p[0], y: p[1] } : null;
    }).filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  const projectedStateLabels = useMemo(() => {
    if (!projectionRef.current) return [];
    const out = [];
    for (const [countryName, states] of Object.entries(STATE_INFO)) {
      for (const [name, lat, lng] of states) {
        const p = projectionRef.current([lng, lat]);
        if (p) out.push({ key: `${countryName}-${name}`, name, x: p[0], y: p[1] });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  const projectedWords = useMemo(() => {
    if (!projectionRef.current) return [];
    return words
      .map((w, i) => {
        const p = projectionRef.current([w.lng, w.lat]);
        if (!p) return null;
        return { ...w, x: p[0], y: p[1], delay: `${(i % 12) * 0.2}s`, _key: `${w.ts}-${i}` };
      })
      .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, size.width, size.height]);

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

  // Escape closes the detail card.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setSelectedWord(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const showStateLabels = k >= STATE_LABEL_MIN_ZOOM;

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

      {selectedWord && (
        <div className="info-card" role="dialog" aria-label="Word details">
          <button className="info-card-close" onClick={() => setSelectedWord(null)} aria-label="Close">
            ×
          </button>
          <div className="info-card-word" style={{ color: selectedWord.color }}>
            {selectedWord.word}
          </div>
          <div className="info-card-rows">
            {selectedWord.district && (
              <div>
                <span>District</span>
                <span>{selectedWord.district}</span>
              </div>
            )}
            {selectedWord.city && (
              <div>
                <span>City</span>
                <span>{selectedWord.city}</span>
              </div>
            )}
            {selectedWord.region && (
              <div>
                <span>State</span>
                <span>{selectedWord.region}</span>
              </div>
            )}
            {selectedWord.country && (
              <div>
                <span>Country</span>
                <span>
                  {flagEmoji(selectedWord.countryCode)} {selectedWord.country}
                </span>
              </div>
            )}
          </div>
          <div className="info-card-time">{timeAgo(selectedWord.ts)}</div>
        </div>
      )}

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
          onClick={() => setSelectedWord(null)}
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

          <g className="map-layer" transform={transform.toString()}>
            {graticuleD && <path className="graticule" d={graticuleD} vectorEffect="non-scaling-stroke" />}

            <g filter="url(#land-shadow)">
              {countryFeatures.map(({ d, name }, i) => (
                <path
                  key={i}
                  className="land"
                  d={d}
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

            {projectedOceanLabels.map((o, i) => (
              <g key={`sea-${i}`} transform={`translate(${o.x},${o.y}) scale(${inverseScale})`}>
                <text className="sea-label" textAnchor="middle">{o.name}</text>
              </g>
            ))}

            {visibleCountryLabels.map(({ f, name, centroid }) => (
              <g
                key={`country-${f.id}`}
                transform={`translate(${centroid[0]},${centroid[1]}) scale(${inverseScale})`}
              >
                <text className="country-label" textAnchor="middle">{name}</text>
              </g>
            ))}

            {showStateLabels &&
              projectedStateLabels.map((s) => (
                <g key={s.key} transform={`translate(${s.x},${s.y}) scale(${inverseScale})`}>
                  <text className="state-label" textAnchor="middle">{s.name}</text>
                </g>
              ))}

            {projectedWords.map((w) => (
              <g
                key={w._key}
                className="word-point"
                transform={`translate(${w.x},${w.y}) scale(${inverseScale})`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedWord(w);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Word: ${w.word}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSelectedWord(w);
                }}
              >
                <circle r="10" fill="transparent" />
                <circle className="point-ring" r="3" stroke={w.color} style={{ animationDelay: w.delay }} />
                <circle
                  className="point-core"
                  r="2.5"
                  fill={w.color}
                  style={{ animationDelay: w.delay, filter: `drop-shadow(0 0 4px ${w.color})` }}
                />
                <text className="word-label" x="6" y="-3" style={{ animationDelay: w.delay }}>
                  {w.word}
                </text>
              </g>
            ))}
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
      <div className="caption">click a point for details · scroll or pinch to zoom</div>
    </div>
  );
}
