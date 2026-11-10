alter table public.lesson_progress
  add column furthest_position_seconds integer not null default 0,
  add column last_accessed_at timestamptz,
  add column playback_updated_at timestamptz;

update public.lesson_progress
set
  furthest_position_seconds = last_position_seconds,
  last_accessed_at = updated_at;

alter table public.lesson_progress
  add constraint lesson_progress_furthest_position_check
    check (furthest_position_seconds >= 0);

create index lesson_progress_student_last_accessed_idx
  on public.lesson_progress (student_id, last_accessed_at desc)
  where last_accessed_at is not null;

create or replace function public.storage_can_access_lesson(path text, bucket text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  course_segment text := split_part(path, '/', 1);
  lesson_segment text := split_part(path, '/', 2);
begin
  if course_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or lesson_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  if bucket = 'lesson-media' then
    return exists (
      select 1
      from public.lessons as lesson
      join public.course_sections as section on section.id = lesson.section_id
      where lesson.id = lesson_segment::uuid
        and section.course_id = course_segment::uuid
        and public.can_access_lesson(lesson.id)
        and (
          lesson.video_storage_path = path
          or lesson.audio_storage_path = path
        )
    );
  end if;

  if bucket = 'learning-resources' then
    return exists (
      select 1
      from public.lesson_resources as resource
      join public.lessons as lesson on lesson.id = resource.lesson_id
      join public.course_sections as section on section.id = lesson.section_id
      where resource.storage_bucket = bucket
        and resource.storage_path = path
        and section.course_id = course_segment::uuid
        and lesson.id = lesson_segment::uuid
        and lesson.is_published
        and public.can_access_course(section.course_id)
        and public.can_access_lesson(lesson.id)
    );
  end if;

  return false;
end;
$$;

revoke all on function public.storage_can_access_lesson(text, text) from public, anon;
grant execute on function public.storage_can_access_lesson(text, text) to authenticated;

drop policy if exists "Authorized users read lesson resources"
  on public.lesson_resources;
create policy "Enrolled students read published lesson resources"
on public.lesson_resources for select to authenticated
using (
  exists (
    select 1
    from public.lessons as lesson
    join public.course_sections as section on section.id = lesson.section_id
    where lesson.id = lesson_resources.lesson_id
      and lesson.is_published
      and (select public.can_access_course(section.course_id))
      and (select public.can_access_lesson(lesson.id))
  )
);

revoke insert, update on public.lesson_progress from authenticated;
grant select on public.lesson_progress to authenticated;

create function public.record_lesson_access(target_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select public.current_user_has_role(array['student']))
    or not (select public.can_access_lesson(target_lesson_id)) then
    raise insufficient_privilege using message = 'This lesson is unavailable.';
  end if;

  insert into public.lesson_progress (
    student_id,
    lesson_id,
    last_accessed_at
  )
  values (
    (select auth.uid()),
    target_lesson_id,
    now()
  )
  on conflict (student_id, lesson_id)
  do update set last_accessed_at = excluded.last_accessed_at;
end;
$$;

create function public.record_lesson_playback_position(
  target_lesson_id uuid,
  target_position_seconds integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson_content_type text;
  lesson_duration integer;
  previous_furthest_position integer := 0;
  previous_playback_updated_at timestamptz;
  elapsed_seconds integer := 0;
  accepted_position integer;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_has_role(array['student']))
    or not (select public.can_access_lesson(target_lesson_id)) then
    raise insufficient_privilege using message = 'This lesson is unavailable.';
  end if;

  if target_position_seconds is null
    or target_position_seconds < 0
    or target_position_seconds > 604800 then
    raise check_violation using message = 'The playback position is invalid.';
  end if;

  select lesson.content_type, lesson.duration_seconds
  into lesson_content_type, lesson_duration
  from public.lessons as lesson
  where lesson.id = target_lesson_id
    and lesson.is_published;

  if not found or lesson_content_type not in ('VIDEO', 'AUDIO', 'MIXED') then
    raise insufficient_privilege using message = 'This lesson is unavailable.';
  end if;

  if lesson_duration is not null
    and target_position_seconds > lesson_duration then
    raise check_violation using message = 'The playback position exceeds the lesson duration.';
  end if;

  select
    progress.furthest_position_seconds,
    progress.playback_updated_at
  into previous_furthest_position, previous_playback_updated_at
  from public.lesson_progress as progress
  where progress.student_id = (select auth.uid())
    and progress.lesson_id = target_lesson_id
  for update;

  previous_furthest_position := coalesce(previous_furthest_position, 0);

  if previous_playback_updated_at is not null then
    elapsed_seconds := least(
      604800,
      greatest(
        0,
        floor(extract(epoch from (clock_timestamp() - previous_playback_updated_at))::numeric)::integer
      )
    );
  end if;

  accepted_position := least(
    target_position_seconds,
    previous_furthest_position + (elapsed_seconds * 2) + 10
  );

  insert into public.lesson_progress as current_progress (
    student_id,
    lesson_id,
    status,
    progress_percent,
    last_position_seconds,
    furthest_position_seconds,
    started_at,
    last_accessed_at,
    playback_updated_at
  )
  values (
    (select auth.uid()),
    target_lesson_id,
    'IN_PROGRESS',
    case
      when lesson_duration > 0 then least(
        99,
        floor(accepted_position * 100.0 / lesson_duration)::integer
      )
      else 0
    end,
    accepted_position,
    accepted_position,
    now(),
    now(),
    now()
  )
  on conflict (student_id, lesson_id)
  do update set
    status = case
      when current_progress.status = 'COMPLETED' then 'COMPLETED'
      else 'IN_PROGRESS'
    end,
    progress_percent = case
      when current_progress.status = 'COMPLETED' then 100
      when lesson_duration > 0 then least(
        99,
        floor(
          greatest(
            current_progress.furthest_position_seconds,
            accepted_position
          ) * 100.0 / lesson_duration
        )::integer
      )
      else 0
    end,
    last_position_seconds = accepted_position,
    furthest_position_seconds = greatest(
      current_progress.furthest_position_seconds,
      accepted_position
    ),
    started_at = coalesce(current_progress.started_at, excluded.started_at),
    completed_at = current_progress.completed_at,
    last_accessed_at = excluded.last_accessed_at,
    playback_updated_at = clock_timestamp();
end;
$$;

create function public.complete_lesson(
  target_lesson_id uuid,
  completion_source text default 'MANUAL'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson_row record;
  required_position integer;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_has_role(array['student']))
    or not (select public.can_access_lesson(target_lesson_id)) then
    raise insufficient_privilege using message = 'This lesson is unavailable.';
  end if;

  if completion_source not in ('MANUAL', 'MEDIA') then
    raise check_violation using message = 'The completion source is invalid.';
  end if;

  select lesson.content_type, lesson.duration_seconds, lesson.is_published
  into lesson_row
  from public.lessons as lesson
  where lesson.id = target_lesson_id;

  if not found or not lesson_row.is_published then
    raise insufficient_privilege using message = 'This lesson is unavailable.';
  end if;

  if completion_source = 'MEDIA' then
    if lesson_row.content_type not in ('VIDEO', 'AUDIO', 'MIXED')
      or lesson_row.duration_seconds is null
      or lesson_row.duration_seconds < 1 then
      raise check_violation using message = 'Media completion cannot be verified for this lesson.';
    end if;

    required_position := greatest(
      1,
      ceil(lesson_row.duration_seconds * 0.9)::integer
    );

    if not exists (
      select 1
      from public.lesson_progress as progress
      where progress.student_id = (select auth.uid())
        and progress.lesson_id = target_lesson_id
        and progress.furthest_position_seconds >= required_position
    ) then
      raise check_violation using message = 'Continue the lesson before marking it complete.';
    end if;
  end if;

  insert into public.lesson_progress as current_progress (
    student_id,
    lesson_id,
    status,
    progress_percent,
    started_at,
    completed_at,
    last_accessed_at
  )
  values (
    (select auth.uid()),
    target_lesson_id,
    'COMPLETED',
    100,
    now(),
    now(),
    now()
  )
  on conflict (student_id, lesson_id)
  do update set
    status = 'COMPLETED',
    progress_percent = 100,
    started_at = coalesce(current_progress.started_at, now()),
    completed_at = coalesce(current_progress.completed_at, now()),
    last_position_seconds = greatest(
      current_progress.last_position_seconds,
      current_progress.furthest_position_seconds
    ),
    furthest_position_seconds = greatest(
      current_progress.furthest_position_seconds,
      current_progress.last_position_seconds
    ),
    last_accessed_at = now();
end;
$$;

create function public.get_student_course_resume()
returns table (
  course_id uuid,
  lesson_id uuid,
  lesson_title text,
  last_position_seconds integer,
  last_accessed_at timestamptz,
  lesson_status text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (section.course_id)
    section.course_id,
    lesson.id,
    lesson.title,
    coalesce(progress.last_position_seconds, 0),
    progress.last_accessed_at,
    coalesce(progress.status, 'NOT_STARTED')
  from public.course_sections as section
  join public.lessons as lesson
    on lesson.section_id = section.id
    and lesson.is_published
  left join public.lesson_progress as progress
    on progress.lesson_id = lesson.id
    and progress.student_id = (select auth.uid())
  where
    (select public.current_user_has_role(array['student']))
    and (select public.can_access_course(section.course_id))
  order by
    section.course_id,
    case
      when progress.status = 'IN_PROGRESS' then 0
      when progress.status is null then 1
      else 2
    end,
    case when progress.status = 'IN_PROGRESS' then progress.last_accessed_at end desc nulls last,
    case when progress.status is null then section.position end asc nulls last,
    case when progress.status is null then lesson.position end asc nulls last,
    progress.last_accessed_at desc nulls last,
    lesson.id;
$$;

revoke all on function public.record_lesson_access(uuid) from public, anon;
revoke all on function public.record_lesson_playback_position(uuid, integer) from public, anon;
revoke all on function public.complete_lesson(uuid, text) from public, anon;
revoke all on function public.get_student_course_resume() from public, anon;

grant execute on function public.record_lesson_access(uuid) to authenticated;
grant execute on function public.record_lesson_playback_position(uuid, integer) to authenticated;
grant execute on function public.complete_lesson(uuid, text) to authenticated;
grant execute on function public.get_student_course_resume() to authenticated;
