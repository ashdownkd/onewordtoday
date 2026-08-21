"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Splash from "./components/Splash";
import MapErrorBoundary from "./components/MapErrorBoundary";
import { INITIAL_CENTER, INITIAL_ZOOM } from "@/lib/mapConfig";
import { flagEmoji } from "@/lib/flag";

// maplibre-gl touches window/document at import time, which crashes
// during Next's server-side render of "use client" components. Loading
// it only on the client (ssr: false) is what fixes that.
const MapView = dynamic(() => import("./components/MapView"), {
  ssr: false,
  loading: () => null,
});

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
  const [mapStatus, setMapStatus] = useState("loading"); // loading | ready | unsupported
  const [mapInstance, setMapInstance] = useState(null);
  const [words, setWords] = useState([]);
  const [count, setCount] = useState(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);

  function handleMapReady(map, status) {
    setMapStatus(status);
    if (map) setMapInstance(map);
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

  function zoomBy(delta) {
    if (!mapInstance) return;
    mapInstance.zoomTo(mapInstance.getZoom() + delta, { duration: 280 });
  }

  function resetView() {
    if (!mapInstance) return;
    mapInstance.flyTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM, duration: 600 });
  }

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
        <button onClick={() => zoomBy(1)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomBy(-1)} aria-label="Zoom out">−</button>
        <button onClick={resetView} aria-label="Reset view" className="zoom-reset">⤾</button>
      </div>

      <div className="map-wrap">
        {mapStatus === "loading" && <div className="map-loading">loading the world…</div>}
        {mapStatus === "unsupported" && (
          <div className="map-loading">
            your browser doesn&rsquo;t support WebGL, so the map can&rsquo;t render here.
          </div>
        )}
        <MapErrorBoundary>
          <MapView words={words} onSelectWord={setSelectedWord} onReady={handleMapReady} />
        </MapErrorBoundary>
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
