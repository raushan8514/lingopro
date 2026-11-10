create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  administrator_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(btrim(action)) between 1 and 100),
  entity_type text not null check (char_length(btrim(entity_type)) between 1 and 80),
  entity_id uuid,
  reason text check (reason is null or char_length(reason) <= 1000),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default now()
);

create index admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_action_created_idx
  on public.admin_audit_logs (action, created_at desc);
create index admin_audit_logs_entity_idx
  on public.admin_audit_logs (entity_type, entity_id, created_at desc);

alter table public.admin_audit_logs enable row level security;
revoke all on public.admin_audit_logs from public, anon, authenticated;
grant select on public.admin_audit_logs to authenticated;
revoke delete on public.course_categories, public.platform_settings from authenticated;

create policy "Administrators read audit history"
on public.admin_audit_logs for select to authenticated
using ((select public.current_user_is_admin()));

create function public.write_admin_audit_log(
  actor_id uuid,
  event_action text,
  event_entity_type text,
  event_entity_id uuid,
  event_reason text,
  event_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_audit_logs (
    administrator_id,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  )
  values (
    actor_id,
    event_action,
    event_entity_type,
    event_entity_id,
    nullif(left(btrim(event_reason), 1000), ''),
    coalesce(event_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.write_admin_audit_log(uuid, text, text, uuid, text, jsonb)
  from public, anon, authenticated;

create function public.capture_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  event_action text;
  event_entity_type text;
  event_entity_id uuid;
  event_metadata jsonb := '{}'::jsonb;
  event_reason text := current_setting('app.admin_action_reason', true);
begin
  if tg_table_name = 'profiles' then
    if old.role is not distinct from new.role then
      return new;
    end if;
    event_action := 'user.role_changed';
    event_entity_type := 'profile';
    event_entity_id := new.id;
    event_metadata := jsonb_build_object(
      'previous_role', old.role,
      'new_role', new.role
    );
  elsif tg_table_name = 'courses' then
    if old.status is not distinct from new.status then
      return new;
    end if;
    event_action := 'course.status_changed';
    event_entity_type := 'course';
    event_entity_id := new.id;
    event_metadata := jsonb_build_object(
      'title', new.title,
      'previous_status', old.status,
      'new_status', new.status
    );
  elsif tg_table_name = 'course_categories' then
    event_action := case when tg_op = 'INSERT'
      then 'category.created' else 'category.updated' end;
    event_entity_type := 'category';
    event_entity_id := new.id;
    event_metadata := jsonb_build_object(
      'name', new.name,
      'slug', new.slug,
      'is_active', new.is_active
    );
  elsif tg_table_name = 'quizzes' then
    if old.is_published is not distinct from new.is_published then
      return new;
    end if;
    event_action := 'assessment.publication_changed';
    event_entity_type := 'assessment';
    event_entity_id := new.id;
    event_metadata := jsonb_build_object(
      'title', new.title,
      'course_id', new.course_id,
      'previous_is_published', old.is_published,
      'is_published', new.is_published
    );
  elsif tg_table_name = 'platform_settings' then
    event_action := case when tg_op = 'INSERT'
      then 'setting.created' else 'setting.updated' end;
    event_entity_type := 'setting';
    event_metadata := jsonb_build_object('setting_key', new.setting_key);
  else
    return new;
  end if;

  perform public.write_admin_audit_log(
    actor_id,
    event_action,
    event_entity_type,
    event_entity_id,
    event_reason,
    event_metadata
  );
  return new;
end;
$$;

revoke all on function public.capture_admin_change() from public, anon, authenticated;

create trigger profiles_capture_admin_role_change
after update of role on public.profiles
for each row execute function public.capture_admin_change();

create trigger courses_capture_admin_status_change
after update of status on public.courses
for each row execute function public.capture_admin_change();

create trigger categories_capture_admin_change
after insert or update on public.course_categories
for each row execute function public.capture_admin_change();

create trigger quizzes_capture_admin_publication_change
after update of is_published on public.quizzes
for each row execute function public.capture_admin_change();

create trigger settings_capture_admin_change
after insert or update on public.platform_settings
for each row execute function public.capture_admin_change();

create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_role text;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;

  if new_role is null or new_role not in ('student', 'instructor', 'admin') then
    raise check_violation using message = 'Invalid account role.';
  end if;

  if target_user_id = (select auth.uid()) then
    raise check_violation using message = 'Administrators cannot change their own role.';
  end if;

  perform pg_advisory_xact_lock(hashtext('lingopro-admin-role-change'));
  if not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;

  select role into previous_role
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    raise no_data_found using message = 'The target profile does not exist.';
  end if;

  if previous_role = 'admin' and new_role <> 'admin'
    and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise check_violation using message = 'The last administrator cannot be demoted.';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;

  if previous_role is distinct from new_role then
    perform public.create_admin_notification(
      target_user_id,
      'Account role updated',
      'Your LingoPro account role has been updated to ' || new_role || '.',
      'ACCOUNT',
      case new_role
        when 'instructor' then '/instructor'
        when 'admin' then '/admin'
        else '/student'
      end
    );
  end if;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

create function public.admin_moderate_course(
  target_course_id uuid,
  moderation_action text,
  moderation_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  current_published_at timestamptz;
  next_status text;
  target_instructor_id uuid;
  target_title text;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;
  if moderation_action is null
    or moderation_action not in ('publish', 'return', 'archive', 'restore')
    or char_length(btrim(coalesce(moderation_reason, ''))) not between 3 and 1000 then
    raise check_violation using message = 'Choose a valid moderation action and provide a reason.';
  end if;

  select status, published_at, instructor_id, title
  into current_status, current_published_at, target_instructor_id, target_title
  from public.courses
  where id = target_course_id
  for update;
  if not found then
    raise no_data_found using message = 'The selected course does not exist.';
  end if;

  next_status := case moderation_action
    when 'publish' then 'PUBLISHED'
    when 'return' then 'DRAFT'
    when 'archive' then 'ARCHIVED'
    when 'restore' then case when current_published_at is null then 'DRAFT' else 'PUBLISHED' end
  end;
  if moderation_action = 'publish' and current_status not in ('DRAFT', 'PENDING_REVIEW') then
    raise check_violation using message = 'Only draft or review-pending courses can be published.';
  end if;
  if moderation_action = 'return' and current_status <> 'PENDING_REVIEW' then
    raise check_violation using message = 'Only review-pending courses can be returned for correction.';
  end if;
  if moderation_action = 'archive' and current_status = 'ARCHIVED' then
    raise check_violation using message = 'The course is already archived.';
  end if;
  if moderation_action = 'restore' and current_status <> 'ARCHIVED' then
    raise check_violation using message = 'Only archived courses can be restored.';
  end if;

  perform set_config('app.admin_action_reason', btrim(moderation_reason), true);
  update public.courses
  set status = next_status,
      published_at = case
        when next_status = 'PUBLISHED' then coalesce(published_at, now())
        when moderation_action = 'return' then null
        when moderation_action = 'restore' and next_status = 'DRAFT' then null
        else published_at
      end
  where id = target_course_id;

  perform public.create_admin_notification(
    target_instructor_id,
    'Course moderation decision',
    'An administrator changed "' || target_title || '" to ' ||
      lower(replace(next_status, '_', ' ')) || '. Reason: ' || btrim(moderation_reason),
    'COURSE',
    '/instructor/courses'
  );
end;
$$;

revoke all on function public.admin_moderate_course(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_course(uuid, text, text) to authenticated;

create function public.admin_unpublish_assessment(
  target_assessment_id uuid,
  moderation_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_course_id uuid;
  target_instructor_id uuid;
  target_title text;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;
  if char_length(btrim(coalesce(moderation_reason, ''))) not between 3 and 1000 then
    raise check_violation using message = 'Provide a moderation reason.';
  end if;

  select quiz.course_id, course.instructor_id, quiz.title
  into target_course_id, target_instructor_id, target_title
  from public.quizzes as quiz
  join public.courses as course on course.id = quiz.course_id
  where quiz.id = target_assessment_id
  for update;
  if not found then
    raise no_data_found using message = 'The selected assessment does not exist.';
  end if;

  perform set_config('app.admin_action_reason', btrim(moderation_reason), true);
  update public.quizzes
  set is_published = false
  where id = target_assessment_id
    and is_published;
  if not found then
    raise check_violation using message = 'The assessment is already unpublished.';
  end if;

  perform public.create_admin_notification(
    target_instructor_id,
    'Assessment moderation decision',
    'An administrator unpublished "' || target_title || '". Reason: ' || btrim(moderation_reason),
    'ASSESSMENT',
    '/instructor/assessments'
  );
end;
$$;

revoke all on function public.admin_unpublish_assessment(uuid, text) from public, anon;
grant execute on function public.admin_unpublish_assessment(uuid, text) to authenticated;

create function public.admin_list_profiles(
  search_term text default '',
  role_filter text default '',
  page_limit integer default 50,
  page_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;
  if page_limit is null or page_offset is null
    or page_limit not between 1 and 100 or page_offset < 0
    or char_length(coalesce(search_term, '')) > 100
    or (coalesce(role_filter, '') <> '' and role_filter not in ('student', 'instructor', 'admin')) then
    raise check_violation using message = 'Invalid user-list filters.';
  end if;

  return query
  with matched as (
    select profile.id, profile.full_name, profile.email, profile.role, profile.created_at
    from public.profiles as profile
    where (role_filter = '' or profile.role = role_filter)
      and (
        nullif(btrim(coalesce(search_term, '')), '') is null
        or position(lower(btrim(coalesce(search_term, ''))) in lower(profile.full_name)) > 0
        or position(lower(btrim(coalesce(search_term, ''))) in lower(profile.email)) > 0
      )
  )
  select matched.id, matched.full_name, matched.email, matched.role, matched.created_at,
    count(*) over ()
  from matched
  order by matched.created_at desc, matched.id
  limit page_limit offset page_offset;
end;
$$;

revoke all on function public.admin_list_profiles(text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_list_profiles(text, text, integer, integer)
  to authenticated;

create function public.admin_list_courses(
  search_term text default '',
  status_filter text default '',
  category_filter uuid default null,
  difficulty_filter text default '',
  language_filter text default '',
  page_limit integer default 50,
  page_offset integer default 0
)
returns table (
  id uuid,
  title text,
  slug text,
  instructor_id uuid,
  instructor_name text,
  category_id uuid,
  category_name text,
  language text,
  difficulty text,
  status text,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;
  if page_limit is null or page_offset is null
    or page_limit not between 1 and 100 or page_offset < 0
    or char_length(coalesce(search_term, '')) > 100
    or (status_filter <> '' and status_filter not in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED'))
    or (difficulty_filter <> '' and difficulty_filter not in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'))
    or char_length(coalesce(language_filter, '')) > 80 then
    raise check_violation using message = 'Invalid course-list filters.';
  end if;

  return query
  with matched as (
    select course.id, course.title, course.slug, course.instructor_id,
      profile.full_name as instructor_name, course.category_id,
      category.name as category_name, course.language, course.difficulty,
      course.status, course.updated_at
    from public.courses as course
    join public.profiles as profile on profile.id = course.instructor_id
    left join public.course_categories as category on category.id = course.category_id
    where (status_filter = '' or course.status = status_filter)
      and (category_filter is null or course.category_id = category_filter)
      and (difficulty_filter = '' or course.difficulty = difficulty_filter)
      and (language_filter = '' or course.language = language_filter)
      and (
        nullif(btrim(coalesce(search_term, '')), '') is null
        or position(lower(btrim(coalesce(search_term, ''))) in lower(course.title)) > 0
        or position(lower(btrim(coalesce(search_term, ''))) in lower(profile.full_name)) > 0
      )
  )
  select matched.id, matched.title, matched.slug, matched.instructor_id,
    matched.instructor_name, matched.category_id, matched.category_name,
    matched.language, matched.difficulty, matched.status, matched.updated_at,
    count(*) over ()
  from matched
  order by matched.updated_at desc, matched.id
  limit page_limit offset page_offset;
end;
$$;

revoke all on function public.admin_list_courses(text, text, uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_list_courses(text, text, uuid, text, text, integer, integer)
  to authenticated;

create function public.admin_list_assessments(
  search_term text default '',
  publication_filter text default '',
  page_limit integer default 50,
  page_offset integer default 0
)
returns table (
  id uuid,
  course_id uuid,
  course_title text,
  instructor_id uuid,
  instructor_name text,
  title text,
  assessment_type text,
  is_published boolean,
  created_at timestamptz,
  question_count bigint,
  attempt_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;
  if page_limit is null or page_offset is null
    or page_limit not between 1 and 100 or page_offset < 0
    or char_length(coalesce(search_term, '')) > 100
    or (publication_filter <> '' and publication_filter not in ('published', 'unpublished')) then
    raise check_violation using message = 'Invalid assessment-list filters.';
  end if;

  return query
  with matched as (
    select quiz.id, quiz.course_id, course.title as course_title,
      course.instructor_id, profile.full_name as instructor_name,
      quiz.title, quiz.assessment_type, quiz.is_published, quiz.created_at,
      (select count(*) from public.quiz_questions as question where question.quiz_id = quiz.id) as question_count,
      (select count(*) from public.quiz_attempts as attempt where attempt.quiz_id = quiz.id) as attempt_count
    from public.quizzes as quiz
    join public.courses as course on course.id = quiz.course_id
    join public.profiles as profile on profile.id = course.instructor_id
    where (publication_filter = ''
      or (publication_filter = 'published' and quiz.is_published)
      or (publication_filter = 'unpublished' and not quiz.is_published))
      and (
        nullif(btrim(coalesce(search_term, '')), '') is null
        or position(lower(btrim(coalesce(search_term, ''))) in lower(quiz.title)) > 0
        or position(lower(btrim(coalesce(search_term, ''))) in lower(course.title)) > 0
        or position(lower(btrim(coalesce(search_term, ''))) in lower(profile.full_name)) > 0
      )
  )
  select matched.id, matched.course_id, matched.course_title,
    matched.instructor_id, matched.instructor_name, matched.title,
    matched.assessment_type, matched.is_published, matched.created_at,
    matched.question_count, matched.attempt_count, count(*) over ()
  from matched
  order by matched.created_at desc, matched.id
  limit page_limit offset page_offset;
end;
$$;

revoke all on function public.admin_list_assessments(text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_list_assessments(text, text, integer, integer)
  to authenticated;

create function public.admin_get_assessment_stats(target_assessment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;
  if not exists (
    select 1 from public.quizzes where id = target_assessment_id
  ) then
    raise no_data_found using message = 'The selected assessment does not exist.';
  end if;

  select jsonb_build_object(
    'attempts', count(*),
    'graded', count(*) filter (where status = 'GRADED'),
    'average_percent', round(
      avg(score / nullif(total_points, 0) * 100)
        filter (where status = 'GRADED' and total_points > 0),
      1
    )
  )
  into result
  from public.quiz_attempts
  where quiz_id = target_assessment_id;
  return result;
end;
$$;

revoke all on function public.admin_get_assessment_stats(uuid) from public, anon;
grant execute on function public.admin_get_assessment_stats(uuid) to authenticated;

create function public.admin_get_dashboard_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;

  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'students', (select count(*) from public.profiles where role = 'student'),
      'instructors', (select count(*) from public.profiles where role = 'instructor'),
      'administrators', (select count(*) from public.profiles where role = 'admin')
    ),
    'courses', jsonb_build_object(
      'total', (select count(*) from public.courses),
      'published', (select count(*) from public.courses where status = 'PUBLISHED'),
      'draft', (select count(*) from public.courses where status = 'DRAFT'),
      'pending_review', (select count(*) from public.courses where status = 'PENDING_REVIEW'),
      'archived', (select count(*) from public.courses where status = 'ARCHIVED')
    ),
    'enrollments', (select count(*) from public.enrollments),
    'published_lessons', (
      select count(*) from public.lessons where is_published
    ),
    'published_assessments', (
      select count(*) from public.quizzes where is_published
    ),
    'assessment_attempts', (select count(*) from public.quiz_attempts),
    'activity_30_days', (
      (select count(*) from public.lesson_progress where updated_at >= now() - interval '30 days')
      + (select count(*) from public.quiz_attempts where created_at >= now() - interval '30 days')
      + (select count(*) from public.enrollments where enrolled_at >= now() - interval '30 days')
    ),
    'recent_users', coalesce((
      select jsonb_agg(to_jsonb(recent))
      from (
        select id, full_name, email, role, created_at
        from public.profiles
        order by created_at desc
        limit 8
      ) as recent
    ), '[]'::jsonb),
    'pending_courses', coalesce((
      select jsonb_agg(to_jsonb(recent))
      from (
        select course.id, course.title, course.instructor_id,
          profile.full_name as instructor_name, course.updated_at
        from public.courses as course
        join public.profiles as profile on profile.id = course.instructor_id
        where course.status = 'PENDING_REVIEW'
        order by course.updated_at asc
        limit 8
      ) as recent
    ), '[]'::jsonb),
    'recent_audit', coalesce((
      select jsonb_agg(to_jsonb(recent))
      from (
        select id, administrator_id, action, entity_type, entity_id, reason, metadata, created_at
        from public.admin_audit_logs
        order by created_at desc
        limit 8
      ) as recent
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_get_dashboard_data() from public, anon;
grant execute on function public.admin_get_dashboard_data() to authenticated;

create function public.admin_get_report_data(report_months integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  period_start date;
  result jsonb;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;
  if report_months is null or report_months not between 1 and 24 then
    raise check_violation using message = 'Choose a reporting period from 1 to 24 months.';
  end if;
  period_start := (
    date_trunc('month', now()) - make_interval(months => report_months - 1)
  )::date;

  select jsonb_build_object(
    'period_months', report_months,
    'period_start', period_start,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('role', role, 'count', count) order by role)
      from (
        select role, count(*) as count from public.profiles group by role order by role
      ) as role_counts
    ), '[]'::jsonb),
    'course_statuses', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', count) order by status)
      from (
        select status, count(*) as count from public.courses group by status order by status
      ) as status_counts
    ), '[]'::jsonb),
    'monthly_enrollments', coalesce((
      select jsonb_agg(jsonb_build_object('month', calendar.month::date, 'count', coalesce(events.count, 0)) order by calendar.month)
      from generate_series(
        date_trunc('month', period_start::timestamptz),
        date_trunc('month', now()),
        interval '1 month'
      ) as calendar(month)
      left join (
        select date_trunc('month', enrolled_at) as month, count(*) as count
        from public.enrollments
        where enrolled_at >= period_start
        group by date_trunc('month', enrolled_at)
      ) as events on events.month = calendar.month
    ), '[]'::jsonb),
    'popular_courses', coalesce((
      select jsonb_agg(to_jsonb(popular))
      from (
        select course.id, course.title, course.status,
          profile.full_name as instructor_name, count(enrollment.id) as enrollment_count
        from public.courses as course
        join public.profiles as profile on profile.id = course.instructor_id
        left join public.enrollments as enrollment on enrollment.course_id = course.id
        group by course.id, profile.full_name
        order by count(enrollment.id) desc, course.title
        limit 10
      ) as popular
    ), '[]'::jsonb),
    'instructor_activity', coalesce((
      select jsonb_agg(to_jsonb(active))
      from (
        select profile.id, profile.full_name,
          count(distinct course.id) as course_count,
          count(distinct enrollment.id) as enrollment_count,
          max(course.updated_at) as last_course_update
        from public.profiles as profile
        left join public.courses as course on course.instructor_id = profile.id
        left join public.enrollments as enrollment on enrollment.course_id = course.id
        where profile.role = 'instructor'
        group by profile.id
        order by max(course.updated_at) desc nulls last, profile.full_name
        limit 10
      ) as active
    ), '[]'::jsonb),
    'lesson_completion', jsonb_build_object(
      'published_lessons', (select count(*) from public.lessons where is_published),
      'completed_records', (select count(*) from public.lesson_progress where status = 'COMPLETED'),
      'progress_records', (select count(*) from public.lesson_progress)
    ),
    'assessments', jsonb_build_object(
      'attempts', (select count(*) from public.quiz_attempts),
      'graded_attempts', (select count(*) from public.quiz_attempts where status = 'GRADED'),
      'average_score_percent', (
        select round(avg(score / nullif(total_points, 0) * 100)::numeric, 1)
        from public.quiz_attempts
        where status = 'GRADED' and total_points > 0
      )
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_get_report_data(integer) from public, anon;
grant execute on function public.admin_get_report_data(integer) to authenticated;
