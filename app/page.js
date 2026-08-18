"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import { feature } from "topojson-client";
import Splash from "./components/Splash";
import { COUNTRY_INFO } from "@/lib/countryData";
import { CONTINENT_COLORS, slugify } from "@/lib/continents";
import { OCEAN_LABELS, CONTINENT_LABELS } from "@/lib/labels";

const WORLD_TOPOJSON_URL = "https://unpkg.com/world-atlas@2/countries-110m.json";
const WIDTH = 1000;
const HEIGHT = 520;

export default function Page() {
  const [entered, setEntered] = useState(false);
  const [land, setLand] = useState(null);
  const [words, setWords] = useState([]);
  const [count, setCount] = useState(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [transform, setTransform] = useState(zoomIdentity);

  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const projectionRef = useRef(null);

  // Load real world map geometry once
  useEffect(() => {
    const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
    projectionRef.current = projection;
    pathRef.current = geoPath(projection);

    fetch(WORLD_TOPOJSON_URL)
      .then((r) => r.json())
      .then((topo) => {
        const countries = feature(topo, topo.objects.countries);
        setLand(countries);
      })
      .catch(() => setError("Couldn't load map data — check your connection."));
  }, []);

  // Zoom + pan: wheel to zoom, drag to pan, pinch on touch.
  // Note: the transform is applied in viewBox units, so cursor-lock
  // precision is approximate at very small screen sizes — functional
  // zoom/pan either way.
  useEffect(() => {
    if (!svgRef.current) return;
    const zoomBehavior = d3zoom()
      .scaleExtent([1, 8])
      .translateExtent([
        [-WIDTH * 0.4, -HEIGHT * 0.4],
        [WIDTH * 1.4, HEIGHT * 1.4],
      ])
      .on("zoom", (event) => setTransform(event.transform));

    const sel = select(svgRef.current);
    sel.call(zoomBehavior);
    return () => sel.on(".zoom", null);
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

  const graticule = geoGraticule10();
  const path = pathRef.current;
  const projection = projectionRef.current;

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

      <div className="map-wrap">
        {!land && <div className="map-loading">loading the world…</div>}
        <svg
          ref={svgRef}
          id="map"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {Object.entries(CONTINENT_COLORS).map(([name, c]) => (
              <radialGradient key={name} id={`grad-${slugify(name)}`} cx="35%" cy="30%" r="80%">
                <stop offset="0%" stopColor={c.light} stopOpacity="0.9" />
                <stop offset="100%" stopColor={c.base} stopOpacity="0.95" />
              </radialGradient>
            ))}
          </defs>

          <g transform={transform.toString()}>
            {path && <path className="graticule" d={path(graticule)} vectorEffect="non-scaling-stroke" />}

            {path &&
              land &&
              land.features.map((f, i) => {
                const info = COUNTRY_INFO[Number(f.id)];
                const continent = info ? info[1] : "Unknown";
                const colors = CONTINENT_COLORS[continent] || CONTINENT_COLORS.Unknown;
                return (
                  <path
                    key={i}
                    className="land"
                    d={path(f)}
                    style={{ fill: `url(#grad-${slugify(continent)})`, stroke: colors.stroke }}
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>{info ? info[0] : "Unknown territory"}</title>
                  </path>
                );
              })}

            {projection &&
              OCEAN_LABELS.map((o, i) => {
                const p = projection([o.lng, o.lat]);
                if (!p) return null;
                return (
                  <text key={i} className="sea-label" x={p[0]} y={p[1]} textAnchor="middle">
                    {o.name}
                  </text>
                );
              })}

            {projection &&
              CONTINENT_LABELS.map((c, i) => {
                const p = projection([c.lng, c.lat]);
                if (!p) return null;
                return (
                  <text key={i} className="continent-label" x={p[0]} y={p[1]} textAnchor="middle">
                    {c.name}
                  </text>
                );
              })}

            {projection &&
              words.map((w, i) => {
                const p = projection([w.lng, w.lat]);
                if (!p) return null;
                const [x, y] = p;
                const delay = `${(i % 12) * 0.2}s`;
                return (
                  <g key={`${w.ts}-${i}`}>
                    <circle
                      className="point-ring"
                      cx={x}
                      cy={y}
                      r="3"
                      stroke={w.color}
                      vectorEffect="non-scaling-stroke"
                      style={{ animationDelay: delay }}
                    />
                    <circle
                      className="point-core"
                      cx={x}
                      cy={y}
                      r="2.5"
                      fill={w.color}
                      style={{ animationDelay: delay }}
                    />
                    <text
                      className="word-label"
                      x={x + 6}
                      y={y - 3}
                      style={{ animationDelay: delay }}
                    >
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
