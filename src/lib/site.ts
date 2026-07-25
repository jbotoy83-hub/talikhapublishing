export const SITE_NAME =
  process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Talikha Publishing";
export const SITE_SHORT_NAME =
  process.env.NEXT_PUBLIC_SITE_SHORT_NAME?.trim() ||
  SITE_NAME.replace(/\s+Publishing$/i, "");
export const SITE_TAGLINE =
  process.env.NEXT_PUBLIC_SITE_TAGLINE?.trim() ||
  "Publishing ideas with purpose.";
export const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim() ||
  `${SITE_NAME} is a publishing platform for research, essays, poetry, books, and community-rooted scholarship.`;
export const SITE_LOCALE =
  process.env.NEXT_PUBLIC_SITE_LOCALE?.trim() || "en_PH";
export const SITE_LANGUAGE = SITE_LOCALE.replace("_", "-");
export const SITE_LOCATION =
  process.env.NEXT_PUBLIC_SITE_LOCATION?.trim() || "Philippines";
export const SITE_AREA_SERVED =
  process.env.NEXT_PUBLIC_SITE_AREA_SERVED?.trim() || "PH";
export const SITE_FOUNDING_YEAR =
  process.env.NEXT_PUBLIC_SITE_FOUNDING_YEAR?.trim() || "";
export const SITE_OG_IMAGE =
  process.env.NEXT_PUBLIC_SITE_OG_IMAGE?.trim() ||
  "/assets/submission-open-book-pen.png";
export const LEGAL_EFFECTIVE_DATE =
  process.env.NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE?.trim() ||
  "Owner approval pending";
export const ANALYTICS_ENABLED =
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED?.trim().toLocaleLowerCase() === "true";
export const CONSENT_STORAGE_KEY = "publishing-site-consent-v1";

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || "https://talikhapublishing.com").replace(/\/$/, "");
}

export function absoluteUrl(path = "/") {
  return new URL(path, `${getSiteUrl()}/`).toString();
}

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "contact@example.com";

export const SOCIAL_LINKS = {
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL?.trim() || ""
};
