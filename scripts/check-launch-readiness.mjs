import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    values[match[1]] = value;
  }
  return values;
}

async function loadEnvironment() {
  const values = {};
  for (const filename of [".env", ".env.production", ".env.local", ".env.production.local"]) {
    const filepath = path.join(root, filename);
    if (!existsSync(filepath)) continue;
    Object.assign(values, parseEnv(await readFile(filepath, "utf8")));
  }
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) values[name] = value;
  }
  return values;
}

const env = await loadEnvironment();
const value = (name) => env[name]?.trim() || "";
const isTrue = (name) => value(name).toLocaleLowerCase() === "true";
const isFalse = (name) => value(name).toLocaleLowerCase() === "false";

function requireValue(name) {
  if (!value(name)) errors.push(`${name} is missing.`);
}

function requireBoolean(name) {
  if (!["true", "false"].includes(value(name).toLocaleLowerCase())) {
    errors.push(`${name} must be explicitly set to true or false.`);
  }
}

for (const name of [
  "SITE_INDEXING_ENABLED",
  "DEMO_CONTENT_ENABLED",
  "SUBMISSIONS_ENABLED",
  "AI_TRAINING_ALLOWED",
  "NEXT_PUBLIC_ANALYTICS_ENABLED"
]) {
  requireBoolean(name);
}

if (!isTrue("SITE_INDEXING_ENABLED")) {
  errors.push("SITE_INDEXING_ENABLED is not true; the deployment is correctly remaining in preview mode.");
}
if (!isFalse("DEMO_CONTENT_ENABLED")) {
  errors.push("DEMO_CONTENT_ENABLED must be explicitly false.");
}
if (!isFalse("LOCAL_ADMIN_BYPASS") && value("LOCAL_ADMIN_BYPASS")) {
  errors.push("LOCAL_ADMIN_BYPASS must be false.");
}
if (isTrue("NEXT_PUBLIC_ANALYTICS_ENABLED")) {
  errors.push("Analytics is marked enabled, but no consent-aware analytics provider is implemented yet.");
}

for (const name of [
  "BACKEND_ISOLATION_CONFIRMED",
  "DATABASE_SECURITY_APPROVED",
  "CONTENT_APPROVED",
  "LEGAL_APPROVED",
  "OWNER_LAUNCH_APPROVED"
]) {
  if (!isTrue(name)) errors.push(`${name} has not been approved.`);
}

for (const name of [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SITE_NAME",
  "NEXT_PUBLIC_SITE_SHORT_NAME",
  "NEXT_PUBLIC_SITE_TAGLINE",
  "NEXT_PUBLIC_SITE_DESCRIPTION",
  "NEXT_PUBLIC_SITE_LOCALE",
  "NEXT_PUBLIC_SITE_LOCATION",
  "NEXT_PUBLIC_SITE_AREA_SERVED",
  "NEXT_PUBLIC_SITE_OG_IMAGE",
  "NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE",
  "NEXT_PUBLIC_CONTACT_EMAIL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "ADMIN_EMAILS",
  "CRON_SECRET"
]) {
  requireValue(name);
}

const siteUrl = value("NEXT_PUBLIC_SITE_URL");
if (siteUrl) {
  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== "https:") errors.push("NEXT_PUBLIC_SITE_URL must use HTTPS.");
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "example.com" ||
      parsed.hostname.endsWith(".vercel.app")
    ) {
      errors.push("NEXT_PUBLIC_SITE_URL must use the owner-approved custom production domain.");
    }
  } catch {
    errors.push("NEXT_PUBLIC_SITE_URL is not a valid absolute URL.");
  }
}

const contactEmail = value("NEXT_PUBLIC_CONTACT_EMAIL");
if (contactEmail.endsWith("@example.com")) {
  errors.push("NEXT_PUBLIC_CONTACT_EMAIL still uses the example.com placeholder.");
}

const socialImage = value("NEXT_PUBLIC_SITE_OG_IMAGE");
if (/lakbay-diwa|replace-before-launch/i.test(socialImage)) {
  errors.push("NEXT_PUBLIC_SITE_OG_IMAGE still points to a legacy or placeholder asset.");
} else if (socialImage.startsWith("/")) {
  const publicImage = path.join(root, "public", socialImage.replace(/^\/+/, ""));
  if (!existsSync(publicImage)) errors.push(`The social image does not exist: public${socialImage}`);
} else if (socialImage) {
  try {
    const parsed = new URL(socialImage);
    if (parsed.protocol !== "https:") errors.push("NEXT_PUBLIC_SITE_OG_IMAGE must use HTTPS.");
  } catch {
    errors.push("NEXT_PUBLIC_SITE_OG_IMAGE must be a public path or absolute HTTPS URL.");
  }
}

if (value("LEGACY_SITE_URL")) {
  errors.push("LEGACY_SITE_URL is still set; remove first-site compatibility configuration.");
}
if (/lakbay-diwa/i.test(value("REMOTE_IMAGE_HOSTS"))) {
  errors.push("REMOTE_IMAGE_HOSTS still allows the first website's image host.");
} else if (value("REMOTE_IMAGE_HOSTS")) {
  warnings.push("REMOTE_IMAGE_HOSTS is non-empty; confirm every external host belongs to the second branch.");
}

if (isTrue("SUBMISSIONS_ENABLED")) {
  for (const name of ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]) requireValue(name);
} else {
  warnings.push("Public submissions will launch closed. This is safe if the owner intends a catalogue-only launch.");
}

if (!value("GOOGLE_SITE_VERIFICATION")) {
  warnings.push("Google Search Console verification is not configured.");
}
if (!value("BING_SITE_VERIFICATION")) {
  warnings.push("Bing Webmaster Tools verification is not configured.");
}
if (!value("NEXT_PUBLIC_FACEBOOK_URL")) {
  warnings.push("No verified Facebook URL is configured; the social icon will remain hidden.");
}

async function collectFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const contentFiles = [
  ...await collectFiles(path.join(root, "src", "app", "(public)")),
  ...await collectFiles(path.join(root, "src", "components"))
].filter((filename) => !filename.endsWith(`home-testimonials.tsx`));
const legacyPattern = /Lakbay-Diwa|formerly\s+Lakbay|Butuan City|publications under the old name/i;
const legacyFiles = [];
for (const filename of contentFiles) {
  if (legacyPattern.test(await readFile(filename, "utf8"))) {
    legacyFiles.push(path.relative(root, filename));
  }
}
if (legacyFiles.length) {
  errors.push(`Legacy first-site story copy remains in: ${legacyFiles.join(", ")}.`);
}

const securityMigration = path.join(
  root,
  "supabase",
  "migrations",
  "20260716061739_restrict_editorial_media_metadata.sql"
);
if (!existsSync(securityMigration)) {
  errors.push("The editorial media metadata security migration is missing.");
}

console.log("\nSecond-branch production readiness");
console.log("==================================");
for (const issue of errors) console.log(`ERROR: ${issue}`);
for (const issue of warnings) console.log(`WARN:  ${issue}`);
if (!errors.length && !warnings.length) console.log("No configuration issues found.");
console.log(`\nResult: ${errors.length ? "BLOCKED" : "READY"} (${errors.length} error${errors.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"})`);
console.log("Secret values were not printed. Complete the manual launch checklist before promotion.\n");

if (errors.length) process.exitCode = 1;
