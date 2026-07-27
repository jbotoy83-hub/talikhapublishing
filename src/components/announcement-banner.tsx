"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";

type AnnouncementSettings = { enabled: boolean; presentation: "banner" | "popup" | "both"; category: string; message: string; actionLabel: string; actionHref: string; target: "all" | "home" | "journals" | "submit"; trigger: "load" | "scroll"; delaySeconds: number; dismissible: boolean; frequency: "visit" | "session"; startsAt: string; endsAt: string };
const storageKey = "talikha-announcement-settings-v1";
const defaults: AnnouncementSettings = { enabled: true, presentation: "banner", category: "Announcement", message: "Talikha Publishing is now accepting submissions for all journals.", actionLabel: "Submit your work", actionHref: "/submit", target: "all", trigger: "load", delaySeconds: 0, dismissible: true, frequency: "visit", startsAt: "", endsAt: "" };

function isScheduled(settings: AnnouncementSettings) { const now = Date.now(); return (!settings.startsAt || new Date(settings.startsAt).getTime() <= now) && (!settings.endsAt || new Date(settings.endsAt).getTime() >= now); }
function matchesTarget(target: AnnouncementSettings["target"], path: string) { return target === "all" || (target === "home" && path === "/") || (target === "journals" && path.startsWith("/journals")) || (target === "submit" && path === "/submit"); }

export function AnnouncementBanner() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<AnnouncementSettings>({ ...defaults, enabled: false });
  const [dismissed, setDismissed] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  useEffect(() => { let cancelled = false; void fetch("/api/announcements", { credentials: "same-origin" }).then((response) => (response.ok ? response.json() : null)).then((body) => { if (cancelled) return; if (body?.announcement) { setSettings({ ...defaults, ...body.announcement }); setDismissed(false); } }).catch(() => {}); return () => { cancelled = true; }; }, []);
  const visible = settings.enabled && !dismissed && isScheduled(settings) && matchesTarget(settings.target, pathname || "/");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- popup timer/scroll listener setup; setPopupOpen is a side-effect trigger, not a state mirror
  useEffect(() => { if (!visible || !["popup", "both"].includes(settings.presentation)) { setPopupOpen(false); return; } const sessionKey = `${storageKey}:seen`; if (settings.frequency === "session" && sessionStorage.getItem(sessionKey)) return; const open = () => { setPopupOpen(true); sessionStorage.setItem(sessionKey, "1"); }; if (settings.trigger === "scroll") { const onScroll = () => { if (window.scrollY > 180) { open(); window.removeEventListener("scroll", onScroll); } }; window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); } const timer = window.setTimeout(open, settings.delaySeconds * 1000); return () => window.clearTimeout(timer); }, [visible, settings]);
  if (!visible) return null;
  const close = () => { setDismissed(true); setPopupOpen(false); };
  return <>{["banner", "both"].includes(settings.presentation) && <div className="announcement-banner" role="banner"><div className="announcement-inner"><span className="announcement-eyebrow">{settings.category}</span><span className="announcement-divider" aria-hidden="true" /><p className="announcement-message">{settings.message}</p><Link href={settings.actionHref || "/"} className="announcement-action">{settings.actionLabel}<Icon name="arrow" className="h-3 w-3" /></Link></div>{settings.dismissible && <button type="button" className="announcement-close" onClick={close} aria-label="Dismiss announcement">×</button>}</div>}{popupOpen && <div className="announcement-popup-backdrop" role="presentation"><section className="announcement-popup" role="dialog" aria-modal="true" aria-label={settings.category}><span>{settings.category}</span><h2>{settings.message}</h2><Link href={settings.actionHref || "/"} onClick={close}>{settings.actionLabel}<Icon name="arrow" className="h-4 w-4" /></Link>{settings.dismissible && <button type="button" onClick={close}>Not now</button>}</section></div>}</>;
}
