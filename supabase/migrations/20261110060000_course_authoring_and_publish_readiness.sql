create function public.is_valid_course_learning_outcomes(outcomes text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(coalesce(outcomes, '{}'::text[])) <= 20
    and not exists (
      select 1
      from unnest(coalesce(outcomes, '{}'::text[])) as outcome(value)
      where char_length(btrim(outcome.value)) not between 1 and 300
    );
$$;

revoke all on function public.is_valid_course_learning_outcomes(text[])
  from public, anon;
grant execute on function public.is_valid_course_learning_outcomes(text[])
  to authenticated, service_role;

alter table public.courses
  add column learning_outcomes text[] not null default '{}',
  add column prerequisites text,
  add column target_audience text,
  add constraint courses_learning_outcomes_check check (
    public.is_valid_course_learning_outcomes(learning_outcomes)
  ),
  add constraint courses_prerequisites_length_check check (
    prerequisites is null or char_length(prerequisites) <= 5000
  ),
  add constraint courses_target_audience_length_check check (
    target_audience is null or char_length(target_audience) <= 5000
  );

create function public.course_publication_readiness_issues(target_course_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  issues text[] := array[]::text[];
  section_row record;
  lesson_row record;
  section_count integer;
  published_lesson_count integer;
begin
  if not exists (
    select 1 from public.courses as course where course.id = target_course_id
  ) then
    return array['Course not found.'];
  end if;

  select count(*)::integer
  into section_count
  from public.course_sections as section
  where section.course_id = target_course_id;

  if section_count = 0 then
    issues := array_append(issues, 'Add at least one course section.');
  end if;

  for section_row in
    select section.id, section.title
    from public.course_sections as section
    where section.course_id = target_course_id
    order by section.position
  loop
    select count(*)::integer
    into published_lesson_count
    from public.lessons as lesson
    where lesson.section_id = section_row.id
      and lesson.is_published;

    if published_lesson_count = 0 then
      issues := array_append(
        issues,
        format('Publish at least one lesson in "%s".', section_row.title)
      );
    end if;

    for lesson_row in
      select lesson.title, lesson.content_type, lesson.content,
        lesson.description, lesson.video_url, lesson.video_storage_path,
        lesson.audio_url, lesson.audio_storage_path
      from public.lessons as lesson
      where lesson.section_id = section_row.id
        and lesson.is_published
      order by lesson.position
    loop
      if lesson_row.content_type = 'VIDEO'
        and lesson_row.video_url is null
        and lesson_row.video_storage_path is null then
        issues := array_append(
          issues,
          format('Add a video source to "%s".', lesson_row.title)
        );
      elsif lesson_row.content_type = 'AUDIO'
        and lesson_row.audio_url is null
        and lesson_row.audio_storage_path is null then
        issues := array_append(
          issues,
          format('Add an audio source to "%s".', lesson_row.title)
        );
      elsif lesson_row.content_type = 'TEXT'
        and coalesce(jsonb_array_length(
          case
            when jsonb_typeof(lesson_row.content -> 'blocks') = 'array'
              then lesson_row.content -> 'blocks'
            else '[]'::jsonb
          end
        ), 0) = 0
        and nullif(btrim(lesson_row.content ->> 'body'), '') is null
        and nullif(btrim(lesson_row.description), '') is null then
        issues := array_append(
          issues,
          format('Add reading content to "%s".', lesson_row.title)
        );
      elsif lesson_row.content_type = 'MIXED'
        and lesson_row.video_url is null
        and lesson_row.video_storage_path is null
        and lesson_row.audio_url is null
        and lesson_row.audio_storage_path is null
        and coalesce(jsonb_array_length(
          case
            when jsonb_typeof(lesson_row.content -> 'blocks') = 'array'
              then lesson_row.content -> 'blocks'
            else '[]'::jsonb
          end
        ), 0) = 0
        and nullif(btrim(lesson_row.content ->> 'body'), '') is null
        and nullif(btrim(lesson_row.description), '') is null then
        issues := array_append(
          issues,
          format('Add media or reading content to "%s".', lesson_row.title)
        );
      end if;
    end loop;
  end loop;

  return issues;
end;
$$;

revoke all on function public.course_publication_readiness_issues(uuid)
  from public, anon, authenticated;

create function public.get_course_publication_readiness(target_course_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select public.can_manage_course(target_course_id)) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;
  return public.course_publication_readiness_issues(target_course_id);
end;
$$;

revoke all on function public.get_course_publication_readiness(uuid)
  from public, anon;
grant execute on function public.get_course_publication_readiness(uuid)
  to authenticated;

create function public.enforce_course_publication_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  issues text[];
begin
  if new.status = 'PUBLISHED'
    and tg_op = 'INSERT' then
    issues := public.course_publication_readiness_issues(new.id);
    if cardinality(issues) > 0 then
      raise check_violation using message =
        'The course is not ready to publish: ' || array_to_string(issues, ' ');
    end if;
  elsif new.status = 'PUBLISHED'
    and old.status is distinct from new.status then
    issues := public.course_publication_readiness_issues(new.id);
    if cardinality(issues) > 0 then
      raise check_violation using message =
        'The course is not ready to publish: ' || array_to_string(issues, ' ');
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_course_publication_readiness()
  from public, anon, authenticated;

create trigger courses_enforce_publication_readiness
before insert or update of status on public.courses
for each row execute function public.enforce_course_publication_readiness();

create or replace function public.get_public_course_details(target_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', course.id,
    'instructor_id', course.instructor_id,
    'category_id', course.category_id,
    'title', course.title,
    'slug', course.slug,
    'short_description', course.short_description,
    'description', course.description,
    'learning_outcomes', course.learning_outcomes,
    'prerequisites', course.prerequisites,
    'target_audience', course.target_audience,
    'language', course.language,
    'difficulty', course.difficulty,
    'thumbnail_url', course.thumbnail_url,
    'price_cents', course.price_cents,
    'currency', course.currency,
    'estimated_duration_minutes', course.estimated_duration_minutes,
    'published_at', course.published_at,
    'category_name', category.name,
    'category_slug', category.slug
  )
  from public.courses as course
  left join public.course_categories as category
    on category.id = course.category_id
    and category.is_active
  where course.slug = target_slug
    and course.status = 'PUBLISHED';
$$;
