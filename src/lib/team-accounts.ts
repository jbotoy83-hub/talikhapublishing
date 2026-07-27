import "server-only";

export const TEAM_LOGIN_DOMAIN = "team.talikha.internal";
export const TEAM_VIEWS = ["overview", "submissions", "schedule", "authors", "studies", "bank", "featured", "reports", "certificates", "journals", "production", "media", "announcements"] as const;

export type TeamView = (typeof TEAM_VIEWS)[number];

export function normalizeTeamUsername(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function isTeamUsername(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

export function teamLoginEmail(username: string) {
  return `${normalizeTeamUsername(username)}@${TEAM_LOGIN_DOMAIN}`;
}

export function validTeamViews(value: unknown): TeamView[] {
  if (!Array.isArray(value)) return [];
  return value.filter((view): view is TeamView => typeof view === "string" && TEAM_VIEWS.includes(view as TeamView));
}
