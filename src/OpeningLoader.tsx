import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export const OPENING_STEPS = 7;

export function OpeningLoader({ ready }: { ready: number }) {
  const percent = Math.round(
    (Math.min(ready, OPENING_STEPS) / OPENING_STEPS) * 100,
  );
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    const wasInert = root?.inert ?? false;
    const overflow = document.documentElement.style.overflow;
    if (root) root.inert = true;
    document.documentElement.style.overflow = "hidden";
    return () => {
      if (root) root.inert = wasInert;
      document.documentElement.style.overflow = overflow;
    };
  }, []);
  return createPortal(
    <div className="journey-loader" data-lenis-prevent>
      <span className="journey-loader-brand">AIR BOOKING</span>
      <div className="journey-loader-status">
        <p>Preparing your journey</p>
        <div
          className="journey-loader-meter"
          role="progressbar"
          aria-label="Opening progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div style={{ width: `${percent}%` }} />
        </div>
        <small>{percent}%</small>
      </div>
    </div>,
    document.body,
  );
}
