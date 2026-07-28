"use client";

import { Icon } from "./icon";

export function FeaturedNav({ targetId }: { targetId: string }) {
  function move(direction: 1 | -1) {
    const element = document.getElementById(targetId);
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(300, element.clientWidth * 0.82), behavior: "smooth" });
  }
  return (
    <div className="journal-recognition-nav" aria-label="Scroll featured publications">
      <button type="button" className="journal-recognition-nav-btn" onClick={() => move(-1)} aria-label="Show previous featured publications"><Icon name="arrow" className="h-4 w-4 rotate-180" /></button>
      <button type="button" className="journal-recognition-nav-btn" onClick={() => move(1)} aria-label="Show next featured publications"><Icon name="arrow" className="h-4 w-4" /></button>
    </div>
  );
}
