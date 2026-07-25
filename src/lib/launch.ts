import "server-only";
import { getSiteUrl } from "@/lib/site";

function enabled(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() === "true";
}

export function isDemoContentEnabled() {
  if (process.env.DEMO_CONTENT_ENABLED !== undefined) {
    return enabled(process.env.DEMO_CONTENT_ENABLED);
  }
  return process.env.NODE_ENV !== "production";
}

export function isIndexingEnabled() {
  return enabled(process.env.SITE_INDEXING_ENABLED);
}

export function isSubmissionsEnabled() {
  if (process.env.SUBMISSIONS_ENABLED !== undefined) {
    return enabled(process.env.SUBMISSIONS_ENABLED);
  }
  return process.env.NODE_ENV !== "production";
}

export function isAiTrainingAllowed() {
  return enabled(process.env.AI_TRAINING_ALLOWED);
}

function getLaunchConfigurationIssues() {
  if (!isIndexingEnabled()) return [];

  const issues: string[] = [];
  const siteUrl = getSiteUrl();

  if (!process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    issues.push("NEXT_PUBLIC_SITE_URL is required when indexing is enabled.");
  } else {
    try {
      const url = new URL(siteUrl);
      if (url.protocol !== "https:") issues.push("NEXT_PUBLIC_SITE_URL must use HTTPS.");
      if (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "example.com"
      ) {
        issues.push("NEXT_PUBLIC_SITE_URL must use the final custom domain.");
      }
    } catch {
      issues.push("NEXT_PUBLIC_SITE_URL must be a valid absolute URL.");
    }
  }

  const requiredPublic = [
    "NEXT_PUBLIC_SITE_NAME",
    "NEXT_PUBLIC_SITE_DESCRIPTION",
    "NEXT_PUBLIC_CONTACT_EMAIL",
    "NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE"
  ];
  for (const name of requiredPublic) {
    if (!process.env[name]?.trim()) issues.push(`${name} is required when indexing is enabled.`);
  }

  if (isDemoContentEnabled()) {
    issues.push("DEMO_CONTENT_ENABLED must be false before indexing is enabled.");
  }

  for (const name of [
    "DATABASE_SECURITY_APPROVED",
    "CONTENT_APPROVED",
    "LEGAL_APPROVED",
    "OWNER_LAUNCH_APPROVED"
  ]) {
    if (!enabled(process.env[name])) {
      issues.push(`${name} must be true before indexing is enabled.`);
    }
  }

  if (enabled(process.env.NEXT_PUBLIC_ANALYTICS_ENABLED)) {
    issues.push(
      "NEXT_PUBLIC_ANALYTICS_ENABLED must remain false until a consent-aware analytics provider is implemented."
    );
  }

  return issues;
}

export function assertLaunchConfiguration() {
  const issues = getLaunchConfigurationIssues();
  if (issues.length) {
    throw new Error(`Production launch configuration is incomplete:\n- ${issues.join("\n- ")}`);
  }
}
