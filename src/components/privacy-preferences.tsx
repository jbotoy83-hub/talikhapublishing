"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { ANALYTICS_ENABLED, CONSENT_STORAGE_KEY } from "@/lib/site";
import { Icon } from "./icon";

export function PrivacyPreferences() {
  const [selected, setSelected] = useState<"all" | "essential" | null>(null);
  const subscribe = useCallback(() => () => undefined, []);
  const savedChoice = useSyncExternalStore(
    subscribe,
    () => {
      const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
      return saved === "all" || saved === "essential" ? saved : null;
    },
    () => null,
  );
  const choice = selected ?? savedChoice;
  function select(value: "all" | "essential") {
    localStorage.setItem(CONSENT_STORAGE_KEY, value);
    setSelected(value);
  }
  return <section id="privacyPreferences" className="privacy-preference-card">
    <div><span><Icon name="shield" className="h-6 w-6" /></span><p>Privacy preference</p><h2>{ANALYTICS_ENABLED ? "Choose what this site may remember." : "Optional analytics are currently disabled."}</h2><small>{ANALYTICS_ENABLED ? "Essential storage supports security and remembers this choice. Optional analytics are not enabled unless you explicitly allow them." : "The site currently uses essential storage only. No analytics preference is required unless analytics are enabled for the final branch."}</small></div>
    {ANALYTICS_ENABLED && <div>
      <button type="button" className={choice === "essential" ? "selected" : ""} onClick={() => select("essential")}>Essential only</button>
      <button type="button" className={`primary${choice === "all" ? " selected" : ""}`} onClick={() => select("all")}>Allow analytics</button>
    </div>}
  </section>;
}
