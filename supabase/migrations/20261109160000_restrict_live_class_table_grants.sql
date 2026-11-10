revoke all on table public.live_classes from public, anon, authenticated;

grant select (
  id,
  course_id,
  instructor_id,
  title,
  description,
  meeting_provider,
  scheduled_start,
  scheduled_end,
  status,
  created_at,
  updated_at,
  max_participants,
  meeting_status
) on public.live_classes to authenticated;

grant insert (
  course_id,
  instructor_id,
  title,
  description,
  meeting_provider,
  meeting_reference,
  scheduled_start,
  scheduled_end,
  status,
  max_participants
) on public.live_classes to authenticated;

grant update (
  course_id,
  instructor_id,
  title,
  description,
  meeting_provider,
  meeting_reference,
  scheduled_start,
  scheduled_end,
  status,
  max_participants
) on public.live_classes to authenticated;

grant delete on public.live_classes to authenticated;
