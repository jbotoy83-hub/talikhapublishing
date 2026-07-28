import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type JournalRow = { id: string; current_issue_id: string | null; submission_issue_id: string | null };
type IssueRow = { id: string; journal_id: string; status: string | null; publication_date: string | null; editorial_metadata: unknown; volume: string | null; issue_number: string | null };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function issueSort(a: IssueRow, b: IssueRow) {
  const dateOrder = String(b.publication_date || "").localeCompare(String(a.publication_date || ""));
  if (dateOrder) return dateOrder;
  const volumeOrder = Number(b.volume || 0) - Number(a.volume || 0);
  if (volumeOrder) return volumeOrder;
  return Number(b.issue_number || 0) - Number(a.issue_number || 0);
}

function acceptsThrough(issue: IssueRow | undefined, today: string) {
  const metadata = issue?.editorial_metadata && typeof issue.editorial_metadata === "object" ? issue.editorial_metadata as { submissionDeadline?: string } : {};
  return Boolean(issue && issue.status !== "archived" && (!metadata.submissionDeadline || metadata.submissionDeadline >= today));
}

export async function synchronizeJournalLifecycles(admin: SupabaseClient, journalId?: string) {
  const today = todayIso();
  let journalsQuery = admin.from("journals").select("id,current_issue_id,submission_issue_id").eq("status", "published");
  if (journalId) journalsQuery = journalsQuery.eq("id", journalId);
  const { data: journals, error: journalsError } = await journalsQuery;
  if (journalsError) return { changed: 0 };
  if (!journals?.length) return { changed: 0 };

  const ids = journals.map((journal) => journal.id);
  const { data: issues, error: issuesError } = await admin
    .from("issues")
    .select("id,journal_id,status,publication_date,editorial_metadata,volume,issue_number")
    .in("journal_id", ids)
    .neq("status", "archived");
  if (issuesError) return { changed: 0 };

  let changed = 0;
  for (const journal of journals as JournalRow[]) {
    const journalIssues = ((issues || []) as IssueRow[]).filter((issue) => issue.journal_id === journal.id);
    const due = journalIssues
      .filter((issue) => issue.publication_date && issue.publication_date <= today)
      .sort(issueSort)[0];
    const current = journalIssues.find((issue) => issue.id === journal.current_issue_id);
    const nextCurrent = due || current;
    const existingTarget = journalIssues.find((issue) => issue.id === journal.submission_issue_id);
    const nextTarget = acceptsThrough(existingTarget, today)
      ? existingTarget
      : acceptsThrough(nextCurrent, today)
        ? nextCurrent
        : null;

    if (!nextCurrent) continue;
    const issueUpdates = journalIssues.filter((issue) => issue.publication_date && issue.publication_date <= today && issue.status !== "published");
    for (const issue of issueUpdates) {
      const { error } = await admin.from("issues").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", issue.id);
      if (error) continue;
      changed += 1;
    }

    if (journal.current_issue_id !== nextCurrent.id || journal.submission_issue_id !== (nextTarget?.id || null)) {
      const { error } = await admin.from("journals").update({ current_issue_id: nextCurrent.id, submission_issue_id: nextTarget?.id || null, updated_at: new Date().toISOString() }).eq("id", journal.id);
      if (error) continue;
      changed += 1;
    }
  }
  return { changed };
}

type DuePublicationRecord = { submission_id: string };
type LifecycleActor = { id: string };

export async function publishDuePublications(admin: SupabaseClient) {
  const { data: actor, error: actorError } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["admin", "editor"])
    .limit(1)
    .maybeSingle();
  if (actorError) throw new Error(`scheduled publish actor lookup failed: ${actorError.message}`);
  if (!actor) return { published: 0, failed: 0 };

  const now = new Date().toISOString();
  const { data: dueRecords, error: dueError } = await admin
    .from("publication_records")
    .select("submission_id")
    .not("scheduled_for", "is", null)
    .is("published_at", null)
    .lte("scheduled_for", now);
  if (dueError) throw new Error(`scheduled publish read failed: ${dueError.message}`);
  if (!dueRecords?.length) return { published: 0, failed: 0 };

  let published = 0;
  let failed = 0;
  for (const record of dueRecords as DuePublicationRecord[]) {
    const { error } = await admin.rpc("transition_submission", {
      p_submission_id: record.submission_id,
      p_to_stage: "published",
      p_actor_id: (actor as LifecycleActor).id,
      p_internal_title: "Published automatically",
      p_internal_description: "The scheduled publication date arrived, so the lifecycle job published this study.",
      p_public_title: null,
      p_public_description: null,
      p_visibility: "internal",
      p_metadata: {},
    });
    if (error) {
      failed += 1;
      console.error(`[journal-lifecycle] scheduled publish failed for ${record.submission_id}: ${error.message}`);
      continue;
    }
    published += 1;
  }
  return { published, failed };
}
