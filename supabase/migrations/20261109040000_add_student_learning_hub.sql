create table public.student_learning_goals (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  daily_lesson_target integer not null default 1 check (
    daily_lesson_target between 1 and 20
  ),
  weekly_lesson_target integer not null default 5 check (
    weekly_lesson_target between 1 and 100
  ),
  timezone text not null default 'UTC' check (
    char_length(btrim(timezone)) between 1 and 64
  ),
  preferred_language text check (
    preferred_language is null
    or char_length(btrim(preferred_language)) between 2 and 80
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger student_learning_goals_set_updated_at
before update on public.student_learning_goals
for each row execute function public.set_updated_at();

create function public.validate_student_learning_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names as zone
    where zone.name = new.timezone
  ) then
    raise check_violation using message = 'A valid IANA timezone is required.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_student_learning_timezone() from public, anon, authenticated;

create trigger student_learning_goals_validate_timezone
before insert or update of timezone on public.student_learning_goals
for each row execute function public.validate_student_learning_timezone();

alter table public.student_learning_goals enable row level security;

grant select, insert, update on public.student_learning_goals to authenticated;

create policy "Students manage their own learning goals"
on public.student_learning_goals for all to authenticated
using (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
)
with check (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
);

create index lesson_progress_student_completed_idx
  on public.lesson_progress (student_id, completed_at desc)
  where status = 'COMPLETED';

create index quiz_attempts_student_submitted_idx
  on public.quiz_attempts (student_id, submitted_at desc)
  where submitted_at is not null;

create function public.get_student_course_progress()
returns table (
  course_id uuid,
  total_lessons integer,
  completed_lessons integer,
  in_progress_lessons integer,
  last_lesson_title text,
  last_activity_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with eligible_enrollments as (
    select enrollment.course_id
    from public.enrollments as enrollment
    where enrollment.student_id = (select auth.uid())
      and enrollment.status in ('ACTIVE', 'COMPLETED')
      and (
        enrollment.expires_at is null
        or enrollment.expires_at > now()
      )
      and (select public.current_user_has_role(array['student']))
  )
  select
    enrollment.course_id,
    count(lesson.id)::integer as total_lessons,
    count(lesson.id) filter (
      where progress.status = 'COMPLETED'
    )::integer as completed_lessons,
    count(lesson.id) filter (
      where progress.status = 'IN_PROGRESS'
    )::integer as in_progress_lessons,
    (
      array_agg(
        lesson.title
        order by progress.updated_at desc nulls last, lesson.position
      ) filter (where progress.status in ('IN_PROGRESS', 'COMPLETED'))
    )[1] as last_lesson_title,
    max(progress.updated_at) as last_activity_at
  from eligible_enrollments as enrollment
  left join public.course_sections as section
    on section.course_id = enrollment.course_id
  left join public.lessons as lesson
    on lesson.section_id = section.id
    and lesson.is_published
  left join public.lesson_progress as progress
    on progress.lesson_id = lesson.id
    and progress.student_id = (select auth.uid())
  group by enrollment.course_id;
$$;

create function public.get_student_learning_streak(target_timezone text)
returns table (current_streak integer, longest_streak integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if target_timezone is null or not exists (
    select 1
    from pg_catalog.pg_timezone_names as zone
    where zone.name = target_timezone
  ) then
    raise check_violation using message = 'A valid IANA timezone is required.';
  end if;

  return query
  with activity_days as (
    select (progress.completed_at at time zone target_timezone)::date as activity_date
    from public.lesson_progress as progress
    where progress.student_id = (select auth.uid())
      and progress.status = 'COMPLETED'
      and progress.completed_at is not null
      and (select public.current_user_has_role(array['student']))

    union

    select (attempt.submitted_at at time zone target_timezone)::date
    from public.quiz_attempts as attempt
    where attempt.student_id = (select auth.uid())
      and attempt.submitted_at is not null
      and (select public.current_user_has_role(array['student']))
  ),
  streak_groups as (
    select
      activity_date,
      activity_date - row_number() over (order by activity_date)::integer as group_id
    from activity_days
  ),
  streaks as (
    select group_id, count(*)::integer as length, max(activity_date) as last_date
    from streak_groups
    group by group_id
  ),
  local_today as (
    select (now() at time zone target_timezone)::date as value
  )
  select
    coalesce(
      max(streak.length) filter (
        where streak.last_date between local_today.value - 1 and local_today.value
      ),
      0
    )::integer,
    coalesce(max(streak.length), 0)::integer
  from streaks as streak
  cross join local_today;
end;
$$;

create function public.get_student_learning_activity(
  target_offset integer default 0,
  target_limit integer default 20,
  requested_type text default null
)
returns table (
  activity_id text,
  activity_type text,
  title text,
  description text,
  occurred_at timestamptz,
  target_url text,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if target_offset is null or target_offset < 0 or target_offset > 10000
    or target_limit is null or target_limit < 1 or target_limit > 50 then
    raise check_violation using message = 'Activity pagination is outside the allowed range.';
  end if;

  if requested_type is not null and requested_type not in (
    'COURSE_ENROLLED',
    'LESSON_STARTED',
    'LESSON_COMPLETED',
    'QUIZ_ATTEMPTED',
    'QUIZ_PASSED',
    'CERTIFICATE_EARNED'
  ) then
    raise check_violation using message = 'The activity filter is not supported.';
  end if;

  return query
  with activities as (
    select
      enrollment.id::text || ':enrolled' as activity_id,
      'COURSE_ENROLLED'::text as activity_type,
      'Enrolled in ' || course.title as title,
      course.language || ' course' as description,
      enrollment.enrolled_at as occurred_at,
      '/courses/' || course.slug as target_url
    from public.enrollments as enrollment
    join public.courses as course on course.id = enrollment.course_id
    where enrollment.student_id = (select auth.uid())
      and (select public.current_user_has_role(array['student']))

    union all

    select
      progress.id::text || ':started',
      'LESSON_STARTED',
      'Started ' || lesson.title,
      course.title,
      progress.started_at,
      '/courses/' || course.slug
    from public.lesson_progress as progress
    join public.lessons as lesson on lesson.id = progress.lesson_id
    join public.course_sections as section on section.id = lesson.section_id
    join public.courses as course on course.id = section.course_id
    where progress.student_id = (select auth.uid())
      and progress.started_at is not null
      and progress.status in ('IN_PROGRESS', 'COMPLETED')
      and lesson.is_published
      and (select public.current_user_has_role(array['student']))

    union all

    select
      progress.id::text || ':completed',
      'LESSON_COMPLETED',
      'Completed ' || lesson.title,
      course.title,
      progress.completed_at,
      '/courses/' || course.slug
    from public.lesson_progress as progress
    join public.lessons as lesson on lesson.id = progress.lesson_id
    join public.course_sections as section on section.id = lesson.section_id
    join public.courses as course on course.id = section.course_id
    where progress.student_id = (select auth.uid())
      and progress.status = 'COMPLETED'
      and progress.completed_at is not null
      and lesson.is_published
      and (select public.current_user_has_role(array['student']))

    union all

    select
      attempt.id::text || ':quiz',
      case
        when attempt.status = 'GRADED'
          and quiz.passing_score is not null
          and attempt.total_points > 0
          and attempt.score / attempt.total_points * 100 >= quiz.passing_score
          then 'QUIZ_PASSED'
        else 'QUIZ_ATTEMPTED'
      end,
      case
        when attempt.status = 'GRADED'
          and quiz.passing_score is not null
          and attempt.total_points > 0
          and attempt.score / attempt.total_points * 100 >= quiz.passing_score
          then 'Passed ' || quiz.title
        else 'Submitted ' || quiz.title
      end,
      course.title,
      attempt.submitted_at,
      '/courses/' || course.slug
    from public.quiz_attempts as attempt
    join public.quizzes as quiz on quiz.id = attempt.quiz_id
    join public.courses as course on course.id = quiz.course_id
    where attempt.student_id = (select auth.uid())
      and attempt.submitted_at is not null
      and (select public.current_user_has_role(array['student']))

    union all

    select
      certificate.id::text || ':certificate',
      'CERTIFICATE_EARNED',
      'Earned a certificate in ' || course.title,
      certificate.certificate_number,
      certificate.issued_at,
      '/student/achievements'
    from public.certificates as certificate
    join public.courses as course on course.id = certificate.course_id
    where certificate.student_id = (select auth.uid())
      and certificate.status = 'ISSUED'
      and (select public.current_user_has_role(array['student']))
  ),
  filtered_activities as (
    select *
    from activities
    where requested_type is null or activities.activity_type = requested_type
  ),
  counted_activities as (
    select
      filtered_activities.*,
      count(*) over () as total_count
    from filtered_activities
  )
  select
    counted.activity_id,
    counted.activity_type,
    counted.title,
    counted.description,
    counted.occurred_at,
    counted.target_url,
    counted.total_count
  from counted_activities as counted
  order by counted.occurred_at desc, counted.activity_id desc
  limit target_limit
  offset target_offset;
end;
$$;

create function public.get_public_instructor_profiles(target_instructor_ids uuid[])
returns table (id uuid, full_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.full_name, profile.avatar_url
  from public.profiles as profile
  where target_instructor_ids is not null
    and cardinality(target_instructor_ids) between 1 and 100
    and profile.role = 'instructor'
    and profile.id = any(target_instructor_ids)
    and exists (
      select 1
      from public.courses as course
      where course.instructor_id = profile.id
        and course.status = 'PUBLISHED'
    );
$$;

revoke all on function public.get_student_course_progress() from public, anon;
revoke all on function public.get_student_learning_streak(text) from public, anon;
revoke all on function public.get_student_learning_activity(integer, integer, text) from public, anon;
revoke all on function public.get_public_instructor_profiles(uuid[]) from public;

grant execute on function public.get_student_course_progress() to authenticated;
grant execute on function public.get_student_learning_streak(text) to authenticated;
grant execute on function public.get_student_learning_activity(integer, integer, text) to authenticated;
grant execute on function public.get_public_instructor_profiles(uuid[]) to anon, authenticated;
