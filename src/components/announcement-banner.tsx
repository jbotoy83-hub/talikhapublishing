"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";
import { XIcon } from "./icons/x";

type AnnouncementSettings = {
  enabled: boolean;
  presentation: "banner" | "popup" | "both";
  category: string;
  message: string;
  popupDescription: string;
  titleFontSize: number;
  descriptionFontSize: number;
  actionLabel: string;
  actionHref: string;
  imageUrl: string | null;
  imageAlt: string;
  layout: "image-led" | "split";
  target: "all" | "home" | "journals" | "submit";
  trigger: "load" | "scroll";
  delaySeconds: number;
  dismissible: boolean;
  frequency: "visit" | "session";
  startsAt: string;
  endsAt: string;
};

const storageKey = "talikha-announcement-settings-v1";
const defaults: AnnouncementSettings = {
  enabled: true,
  presentation: "banner",
  category: "Announcement",
  message: "Talikha Publishing is now accepting submissions for all journals.",
  popupDescription: "",
  titleFontSize: 48,
  descriptionFontSize: 18,
  actionLabel: "Submit your work",
  actionHref: "/submit",
  imageUrl: null,
  imageAlt: "",
  layout: "image-led",
  target: "all",
  trigger: "load",
  delaySeconds: 0,
  dismissible: true,
  frequency: "visit",
  startsAt: "",
  endsAt: "",
};

function isScheduled(settings: AnnouncementSettings) {
  const now = Date.now();
  return (
    (!settings.startsAt || new Date(settings.startsAt).getTime() <= now) &&
    (!settings.endsAt || new Date(settings.endsAt).getTime() >= now)
  );
}

function matchesTarget(target: AnnouncementSettings["target"], path: string) {
  return (
    target === "all" ||
    (target === "home" && path === "/") ||
    (target === "journals" && path.startsWith("/journals")) ||
    (target === "submit" && path === "/submit")
  );
}

export function AnnouncementBanner() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<AnnouncementSettings>({ ...defaults, enabled: false });
  const [dismissed, setDismissed] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [imageState, setImageState] = useState<"empty" | "loading" | "ready" | "error">("empty");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/announcements", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled) return;
        if (body?.announcement) {
          setSettings({ ...defaults, ...body.announcement });
          setDismissed(false);
          setFailedImageUrl(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const url = settings.imageUrl;
    if (!url) {
      setImageState("empty");
      return;
    }
    let cancelled = false;
    setImageState("loading");
    const probe = new window.Image();
    probe.onload = () => { if (!cancelled) setImageState("ready"); };
    probe.onerror = () => { if (!cancelled) setImageState("error"); };
    probe.src = url;
    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [settings.imageUrl]);

  const visible =
    settings.enabled &&
    !dismissed &&
    isScheduled(settings) &&
    matchesTarget(settings.target, pathname || "/");

  useEffect(() => {
    if (!visible || !["popup", "both"].includes(settings.presentation)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close a previously scheduled popup when visibility changes
      setPopupOpen(false);
      return;
    }

    const sessionKey = `${storageKey}:seen`;
    const canReadSession = typeof window !== "undefined" && typeof sessionStorage !== "undefined";
    const wasSeen = canReadSession && settings.frequency === "session" && sessionStorage.getItem(sessionKey);
    if (wasSeen) return;

    const open = () => {
      setPopupOpen(true);
      if (canReadSession) sessionStorage.setItem(sessionKey, "1");
    };

    if (settings.trigger === "scroll") {
      const onScroll = () => {
        if (window.scrollY > 180) {
          open();
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    const timer = window.setTimeout(open, settings.delaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [visible, settings]);

  useEffect(() => {
    if (!popupOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && settings.dismissible) {
        setDismissed(true);
        setPopupOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [popupOpen, settings.dismissible]);

  if (!visible) return null;

  const close = () => {
    setDismissed(true);
    setPopupOpen(false);
  };
  const hasImage = Boolean(settings.imageUrl && imageState === "ready" && settings.imageUrl !== failedImageUrl);
  const popupClassName = [
    "announcement-popup",
    hasImage ? "announcement-popup--image" : "announcement-popup--text-only",
    hasImage && settings.layout === "split" ? "announcement-popup--split" : "announcement-popup--image-led",
  ].join(" ");
  const titleId = "announcement-popup-title";
  const popupTypography = {
    "--announcement-popup-title-size": settings.titleFontSize,
    "--announcement-popup-description-size": settings.descriptionFontSize,
  } as CSSProperties;
  const action = settings.actionLabel ? (
    <Link href={settings.actionHref || "/"} className="announcement-popup-action" onClick={close}>
      {settings.actionLabel}
      <Icon name="arrow" className="h-4 w-4" />
    </Link>
  ) : null;

  return (
    <>
      {["banner", "both"].includes(settings.presentation) && (
        <div className="announcement-banner" role="banner">
          <div className="announcement-inner">
            <span className="announcement-eyebrow">{settings.category}</span>
            <span className="announcement-divider" aria-hidden="true" />
            <p className="announcement-message">{settings.message}</p>
            {settings.actionLabel && (
              <Link href={settings.actionHref || "/"} className="announcement-action">
                {settings.actionLabel}
                <Icon name="arrow" className="h-3 w-3" />
              </Link>
            )}
          </div>
          {settings.dismissible && (
            <button type="button" className="announcement-close" onClick={close} aria-label="Dismiss announcement">
              ×
            </button>
          )}
        </div>
      )}
      {popupOpen && (
        <div className="announcement-popup-backdrop" role="presentation">
          <section
            className={popupClassName}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-layout={hasImage ? settings.layout : "text-only"}
            style={popupTypography}
          >
            {settings.dismissible && (
              <button type="button" className="announcement-popup-close" onClick={close} aria-label="Dismiss announcement">
                <XIcon size={16} strokeWidth={1.8} aria-hidden />
              </button>
            )}
            <div className="announcement-popup-scroll">
              {hasImage && settings.imageUrl && (
                <figure className="announcement-popup-media">
                  <img
                    src={settings.imageUrl}
                    alt={settings.imageAlt || settings.category}
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      setImageState("error");
                      setFailedImageUrl(settings.imageUrl);
                    }}
                  />
                </figure>
              )}
              <div className="announcement-popup-copy">
                <span className="announcement-popup-category">{settings.category}</span>
                <h2 id={titleId}>{settings.message}</h2>
                {settings.popupDescription && <p className="announcement-popup-description">{settings.popupDescription}</p>}
                <div className="announcement-popup-actions">
                  {action}
                  {settings.dismissible && (
                    <button type="button" className="announcement-popup-later" onClick={close}>
                      Not now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
