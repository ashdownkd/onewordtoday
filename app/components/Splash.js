"use client";

import { useEffect, useState } from "react";

export default function Splash({ onEnter }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Enter") dismiss();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onEnter, 650);
  }

  return (
    <div
      className={`splash ${leaving ? "splash-leaving" : ""}`}
      onClick={dismiss}
      role="button"
      tabIndex={0}
      aria-label="Enter One Word Today"
    >
      <div className="splash-inner">
        <h1 className="splash-title">
          One Word<em>Today</em>
        </h1>
        <p className="splash-subtitle">How was your day, in one word?</p>
        <p className="splash-hint">press enter to continue</p>
      </div>
    </div>
  );
}
