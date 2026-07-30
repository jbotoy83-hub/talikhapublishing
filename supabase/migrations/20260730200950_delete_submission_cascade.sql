create or replace function public.delete_submission_cascade(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_publication_id uuid;
  v_files jsonb;
begin
  if not exists (select 1 from public.submissions where id = p_submission_id) then
    raise exception 'Submission not found';
  end if;

  select pr.publication_id
    into v_publication_id
    from public.publication_records pr
   where pr.submission_id = p_submission_id;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'bucket', sf.storage_bucket,
      'path', sf.storage_path
    )),
    '[]'::jsonb
  )
    into v_files
    from public.submission_files sf
   where sf.submission_id = p_submission_id;

  -- These records reference the publication and must be removed before the
  -- publication itself can be deleted.
  delete from public.certificate_records
   where submission_id = p_submission_id
      or (v_publication_id is not null and publication_id = v_publication_id);

  -- Submitted/approved preflight runs are protected from deletion by their
  -- record pointers, so clear those pointers before removing the runs.
  update public.publication_records
     set latest_preflight_run_id = null,
         submitted_preflight_run_id = null,
         approved_preflight_run_id = null
   where submission_id = p_submission_id;

  delete from public.publication_preflight_runs
   where submission_id = p_submission_id
      or publication_record_id in (
        select id from public.publication_records where submission_id = p_submission_id
      );

  delete from public.editorial_notes
   where (entity_type = 'submission' and entity_id = p_submission_id)
      or (v_publication_id is not null and entity_type = 'publication' and entity_id = v_publication_id);

  delete from public.publication_records where submission_id = p_submission_id;

  if v_publication_id is not null then
    delete from public.publications where id = v_publication_id;
  end if;

  -- Receipts hold a restrictive reference to payments, so remove them first.
  delete from public.receipts where submission_id = p_submission_id;
  delete from public.payments where submission_id = p_submission_id;

  -- Remaining submission-linked workflow, author, file, notification, and
  -- history rows are removed by the submission foreign-key cascades.
  delete from public.submissions where id = p_submission_id;

  return jsonb_build_object(
    'submissionId', p_submission_id,
    'publicationId', v_publication_id,
    'files', v_files
  );
end;
$$;

revoke execute on function public.delete_submission_cascade(uuid) from public, anon, authenticated;
grant execute on function public.delete_submission_cascade(uuid) to service_role;
