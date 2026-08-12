import "server-only";
import { z } from "zod";

function isSafeAnnouncementHref(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const announcementInput = z.object({
  enabled: z.boolean().default(true),
  presentation: z.enum(["banner", "popup", "both"]).default("banner"),
  category: z.string().trim().max(80).default("Announcement"),
  message: z.string().trim().max(240).default(""),
  popupDescription: z.string().trim().max(500).default(""),
  actionLabel: z.string().trim().max(120).default(""),
  actionHref: z.string().trim().max(500).default("").refine(isSafeAnnouncementHref, "Action links must be a relative path or secure HTTPS URL."),
  imageUrl: z.string().trim().max(1000).nullable().default(null).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Announcement images must use a secure HTTPS URL."),
  imageAlt: z.string().trim().max(160).default(""),
  layout: z.enum(["image-led", "split"]).default("image-led"),
  target: z.enum(["all", "home", "journals", "submit"]).default("all"),
  trigger: z.enum(["load", "scroll"]).default("load"),
  delaySeconds: z.coerce.number().int().min(0).max(300).default(0),
  dismissible: z.boolean().default(true),
  frequency: z.enum(["visit", "session"]).default("visit"),
  startsAt: z.string().trim().default(""),
  endsAt: z.string().trim().default(""),
});

export type AnnouncementInput = z.infer<typeof announcementInput>;

export type AnnouncementRow = {
  id: string;
  enabled: boolean;
  presentation: string;
  category: string;
  message: string;
  popup_description: string;
  action_label: string;
  action_href: string;
  image_url: string | null;
  image_alt: string;
  layout: string;
  target: string;
  display_trigger: string;
  delay_seconds: number;
  dismissible: boolean;
  frequency: string;
  starts_at: string | null;
  ends_at: string | null;
};

export type AnnouncementSettings = {
  id: string;
  enabled: boolean;
  presentation: string;
  category: string;
  message: string;
  popupDescription: string;
  actionLabel: string;
  actionHref: string;
  imageUrl: string | null;
  imageAlt: string;
  layout: "image-led" | "split";
  target: string;
  trigger: string;
  delaySeconds: number;
  dismissible: boolean;
  frequency: string;
  startsAt: string;
  endsAt: string;
};

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toTimestamptz(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toSettings(row: AnnouncementRow): AnnouncementSettings {
  return {
    id: row.id,
    enabled: row.enabled,
    presentation: row.presentation,
    category: row.category,
    message: row.message,
    popupDescription: row.popup_description,
    actionLabel: row.action_label,
    actionHref: row.action_href,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    layout: row.layout === "split" ? "split" : "image-led",
    target: row.target,
    trigger: row.display_trigger,
    delaySeconds: row.delay_seconds,
    dismissible: row.dismissible,
    frequency: row.frequency,
    startsAt: toLocalInput(row.starts_at),
    endsAt: toLocalInput(row.ends_at),
  };
}

export function toPayload(input: AnnouncementInput, actorId: string) {
  return {
    enabled: input.enabled,
    presentation: input.presentation,
    category: input.category,
    message: input.message,
    popup_description: input.popupDescription,
    action_label: input.actionLabel,
    action_href: input.actionHref,
    image_url: input.imageUrl,
    image_alt: input.imageAlt,
    layout: input.layout,
    target: input.target,
    display_trigger: input.trigger,
    delay_seconds: input.delaySeconds,
    dismissible: input.dismissible,
    frequency: input.frequency,
    starts_at: toTimestamptz(input.startsAt),
    ends_at: toTimestamptz(input.endsAt),
    created_by: actorId,
  };
}

export function isWithinWindow(row: AnnouncementRow, nowMs: number = Date.now()): boolean {
  const started = !row.starts_at || new Date(row.starts_at).getTime() <= nowMs;
  const ended = !row.ends_at || new Date(row.ends_at).getTime() >= nowMs;
  return started && ended;
}
