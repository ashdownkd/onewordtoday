"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";

const WORLD_TOPOJSON_URL = "https://unpkg.com/world-atlas@2/countries-110m.json";
const WIDTH = 1000;
const HEIGHT = 520;

export default function Page() {
  const [land, setLand] = useState(null);
  const [words, setWords] = useState([]);
  const [count, setCount] = useState(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
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

  return (
    <div className="canvas">
      <header className="owt-header">
        <div className="logo">
          one word<em>today</em>
        </div>
        <div className="prompt-tag">how was your day, in one word? — mapped live, worldwide</div>
      </header>

      <div className="count-badge">
        <b>{count}</b>
        <br />
        words today
      </div>

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
        <svg id="map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
          {path && <path className="graticule" d={path(graticule)} />}
          {path &&
            land &&
            land.features.map((f, i) => <path key={i} className="land" d={path(f)} />)}

          {path &&
            projectionRef.current &&
            words.map((w, i) => {
              const p = projectionRef.current([w.lng, w.lat]);
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
      <div className="caption">your point appears near your location · words fade after a day</div>
    </div>
  );
}
