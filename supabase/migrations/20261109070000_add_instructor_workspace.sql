alter table public.course_sections
  drop constraint course_sections_course_id_position_key,
  add constraint course_sections_course_id_position_key
    unique (course_id, position)
    deferrable initially immediate;

alter table public.lessons
  drop constraint lessons_section_id_position_key,
  add constraint lessons_section_id_position_key
    unique (section_id, position)
    deferrable initially immediate;

create function public.reorder_course_sections(
  target_course_id uuid,
  ordered_section_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  section_count integer;
begin
  if (select auth.uid()) is null
    or not (select public.can_manage_course(target_course_id))
    or not exists (
      select 1 from public.courses as course
      where course.id = target_course_id
        and course.status in ('DRAFT', 'PENDING_REVIEW')
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  if ordered_section_ids is null
    or cardinality(ordered_section_ids) > 500
    or cardinality(ordered_section_ids) <> (
      select count(distinct supplied.section_id)::integer
      from unnest(ordered_section_ids) as supplied(section_id)
    ) then
    raise check_violation using message = 'The section order is invalid.';
  end if;

  select count(*)::integer
  into section_count
  from public.course_sections as section
  where section.course_id = target_course_id;

  if section_count <> cardinality(ordered_section_ids)
    or exists (
      select 1
      from unnest(ordered_section_ids) as supplied(section_id)
      where not exists (
        select 1 from public.course_sections as section
        where section.id = supplied.section_id
          and section.course_id = target_course_id
      )
    ) then
    raise check_violation using message = 'The section order must include every section in this course exactly once.';
  end if;

  set constraints course_sections_course_id_position_key deferred;
  update public.course_sections as section
  set position = ordered.position - 1
  from unnest(ordered_section_ids) with ordinality
    as ordered(section_id, position)
  where section.id = ordered.section_id
    and section.course_id = target_course_id;
end;
$$;

create function public.reorder_section_lessons(
  target_course_id uuid,
  target_section_id uuid,
  ordered_lesson_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson_count integer;
begin
  if (select auth.uid()) is null
    or not (select public.can_manage_course(target_course_id))
    or not exists (
      select 1 from public.courses as course
      where course.id = target_course_id
        and course.status in ('DRAFT', 'PENDING_REVIEW')
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  if not exists (
    select 1 from public.course_sections as section
    where section.id = target_section_id
      and section.course_id = target_course_id
  ) then
    raise insufficient_privilege using message = 'The section is unavailable.';
  end if;

  if ordered_lesson_ids is null
    or cardinality(ordered_lesson_ids) > 1000
    or cardinality(ordered_lesson_ids) <> (
      select count(distinct supplied.lesson_id)::integer
      from unnest(ordered_lesson_ids) as supplied(lesson_id)
    ) then
    raise check_violation using message = 'The lesson order is invalid.';
  end if;

  select count(*)::integer
  into lesson_count
  from public.lessons as lesson
  where lesson.section_id = target_section_id;

  if lesson_count <> cardinality(ordered_lesson_ids)
    or exists (
      select 1
      from unnest(ordered_lesson_ids) as supplied(lesson_id)
      where not exists (
        select 1 from public.lessons as lesson
        where lesson.id = supplied.lesson_id
          and lesson.section_id = target_section_id
      )
    ) then
    raise check_violation using message = 'The lesson order must include every lesson in this section exactly once.';
  end if;

  set constraints lessons_section_id_position_key deferred;
  update public.lessons as lesson
  set position = ordered.position - 1
  from unnest(ordered_lesson_ids) with ordinality
    as ordered(lesson_id, position)
  where lesson.id = ordered.lesson_id
    and lesson.section_id = target_section_id;
end;
$$;

revoke all on function public.reorder_course_sections(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_section_lessons(uuid, uuid, uuid[]) from public, anon;

grant execute on function public.reorder_course_sections(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_section_lessons(uuid, uuid, uuid[]) to authenticated;
