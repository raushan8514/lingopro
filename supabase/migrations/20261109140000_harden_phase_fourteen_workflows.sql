drop function if exists public.revoke_course_certificate(uuid);

create table if not exists public.live_class_attendance_events (
  id uuid primary key default gen_random_uuid(),
  live_class_id uuid not null references public.live_classes (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  attendance_result text not null check (attendance_result in ('ATTENDED', 'NO_SHOW')),
  attendance_source text not null check (attendance_source in ('INSTRUCTOR', 'PROVIDER')),
  provider_event_id text,
  created_at timestamptz not null default now(),
  unique (attendance_source, provider_event_id)
);

create index if not exists live_class_attendance_events_class_created_idx
  on public.live_class_attendance_events (live_class_id, created_at desc);
alter table public.live_class_attendance_events enable row level security;
revoke all on public.live_class_attendance_events from public, anon, authenticated;
grant select on public.live_class_attendance_events to authenticated;

drop policy if exists "Administrators read live class attendance history"
  on public.live_class_attendance_events;
create policy "Administrators read live class attendance history"
on public.live_class_attendance_events for select to authenticated
using ((select public.current_user_is_admin()));

create or replace function public.capture_certificate_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'SCHEDULED'
    and new.scheduled_start > now() then
    insert into public.certificate_events (
      certificate_id,
      actor_id,
      event_type
    )
    values (new.id, auth.uid(), 'ISSUED');
  elsif old.status is distinct from new.status and new.status = 'REVOKED' then
    insert into public.certificate_events (
      certificate_id,
      actor_id,
      event_type,
      reason
    )
    values (
      new.id,
      new.revoked_by,
      'REVOKED',
      new.revocation_reason
    );
    if (select public.current_user_is_admin()) then
      perform public.write_admin_audit_log(
        new.revoked_by,
        'certificate.revoked',
        'certificate',
        new.id,
        new.revocation_reason,
        jsonb_build_object('student_id', new.student_id, 'course_id', new.course_id)
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.issue_course_certificate(target_enrollment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_row record;
  certificate_id uuid := gen_random_uuid();
  certificate_number text;
  verification_code text := replace(gen_random_uuid()::text, '-', '');
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required.';
  end if;

  select enrollment.student_id, enrollment.course_id, enrollment.status
  into enrollment_row
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id
    and (
      (
        enrollment.student_id = (select auth.uid())
        and (select public.current_user_has_role(array['student']))
      )
      or (select public.current_user_is_admin())
      or (select public.can_manage_course(enrollment.course_id))
    )
  for update;

  if not found then
    raise insufficient_privilege using message = 'The enrollment is unavailable.';
  end if;

  if enrollment_row.status <> 'COMPLETED' then
    raise check_violation using message = 'A completed enrollment is required.';
  end if;

  if not exists (
    select 1
    from public.lessons as lesson
    join public.course_sections as section on section.id = lesson.section_id
    where section.course_id = enrollment_row.course_id
      and lesson.is_published
  ) or exists (
    select 1
    from public.lessons as lesson
    join public.course_sections as section on section.id = lesson.section_id
    where section.course_id = enrollment_row.course_id
      and lesson.is_published
      and not exists (
        select 1
        from public.lesson_progress as progress
        where progress.student_id = enrollment_row.student_id
          and progress.lesson_id = lesson.id
          and progress.status = 'COMPLETED'
      )
  ) then
    raise check_violation using message = 'A verified course completion is required.';
  end if;

  if exists (
    select 1
    from public.quizzes as quiz
    where quiz.course_id = enrollment_row.course_id
      and quiz.is_published
      and quiz.passing_score is not null
      and not exists (
        select 1
        from public.quiz_attempts as attempt
        where attempt.quiz_id = quiz.id
          and attempt.student_id = enrollment_row.student_id
          and attempt.status = 'GRADED'
          and attempt.total_points > 0
          and attempt.score / attempt.total_points * 100 >= quiz.passing_score
      )
  ) then
    raise check_violation using message = 'All required assessments must be passed.';
  end if;

  certificate_number :=
    'LP-' || upper(substr(replace(certificate_id::text, '-', ''), 1, 12));

  insert into public.certificates (
    id,
    student_id,
    course_id,
    enrollment_id,
    certificate_number,
    verification_code,
    certificate_storage_path
  )
  values (
    certificate_id,
    enrollment_row.student_id,
    enrollment_row.course_id,
    target_enrollment_id,
    certificate_number,
    verification_code,
    null
  );
  return certificate_id;
end;
$$;

create or replace function public.notify_user(
  target_user_id uuid,
  notification_title text,
  notification_message text,
  notification_kind text,
  notification_target_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  preference_enabled boolean := true;
begin
  if notification_kind = 'COURSE' then
    select coalesce(preference.course_updates, true)
    into preference_enabled
    from public.notification_preferences as preference
    where preference.user_id = target_user_id;
  elsif notification_kind = 'ASSESSMENT' then
    select coalesce(preference.assessment_updates, true)
    into preference_enabled
    from public.notification_preferences as preference
    where preference.user_id = target_user_id;
  elsif notification_kind = 'CERTIFICATE' then
    select coalesce(preference.certificate_updates, true)
    into preference_enabled
    from public.notification_preferences as preference
    where preference.user_id = target_user_id;
  elsif notification_kind = 'BILLING' then
    select coalesce(preference.billing_updates, true)
    into preference_enabled
    from public.notification_preferences as preference
    where preference.user_id = target_user_id;
  elsif notification_kind = 'LIVE_CLASS' then
    select coalesce(preference.live_class_updates, true)
    into preference_enabled
    from public.notification_preferences as preference
    where preference.user_id = target_user_id;
  end if;

  if preference_enabled is distinct from false then
    insert into public.notifications (
      user_id,
      title,
      message,
      notification_type,
      target_url
    )
    values (
      target_user_id,
      notification_title,
      notification_message,
      notification_kind,
      notification_target_url
    );
  end if;
end;
$$;

create or replace function public.notify_enrollment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status in ('ACTIVE', 'COMPLETED') then
    perform public.notify_user(
      new.student_id,
      'Course access is ready',
      'Your enrollment is active and the course is available in your learning library.',
      'COURSE',
      '/student/courses'
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status
    and new.status = 'ACTIVE' then
    perform public.notify_user(
      new.student_id,
      'Course access is ready',
      'Your enrollment is active and the course is available in your learning library.',
      'COURSE',
      '/student/courses'
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status
    and new.status = 'COMPLETED' then
    perform public.notify_user(
      new.student_id,
      'Course completed',
      'Your course completion has been recorded. Check your achievements for certificate eligibility.',
      'COURSE',
      '/student/achievements'
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_payment_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_title text;
  notification_message text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  case new.status
    when 'SUCCEEDED' then
      notification_title := 'Payment received';
      notification_message := 'Your payment was completed successfully.';
    when 'FAILED' then
      notification_title := 'Payment unsuccessful';
      notification_message := 'A payment attempt was unsuccessful. Review your transactions for details.';
    when 'REFUNDED' then
      notification_title := 'Payment refunded';
      notification_message := 'A payment refund has been recorded.';
    when 'PARTIALLY_REFUNDED' then
      notification_title := 'Partial refund recorded';
      notification_message := 'A partial payment refund has been recorded.';
    else
      return new;
  end case;

  perform public.notify_user(
    new.student_id,
    notification_title,
    notification_message,
    'BILLING',
    '/student/transactions'
  );
  return new;
end;
$$;

create or replace function public.notify_subscription_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_title text;
  notification_message text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  case new.status
    when 'ACTIVE' then
      notification_title := 'Subscription active';
      notification_message := 'Your subscription is active.';
    when 'PAST_DUE' then
      notification_title := 'Subscription payment needs attention';
      notification_message := 'Your subscription is past due. Review your billing details.';
    when 'CANCELLED' then
      notification_title := 'Subscription cancelled';
      notification_message := 'Your subscription cancellation has been recorded.';
    when 'EXPIRED' then
      notification_title := 'Subscription expired';
      notification_message := 'Your subscription has expired.';
    else
      return new;
  end case;

  perform public.notify_user(
    new.student_id,
    notification_title,
    notification_message,
    'BILLING',
    '/student/subscription'
  );
  return new;
end;
$$;

drop trigger if exists payments_notify_lifecycle on public.payments;
create trigger payments_notify_lifecycle
after insert or update of status on public.payments
for each row execute function public.notify_payment_lifecycle();

drop trigger if exists subscriptions_notify_lifecycle on public.subscriptions;
create trigger subscriptions_notify_lifecycle
after insert or update of status on public.subscriptions
for each row execute function public.notify_subscription_lifecycle();

create or replace function public.notify_live_class_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration record;
begin
  if tg_op = 'INSERT' then
    for registration in
      select enrollment.student_id
      from public.enrollments as enrollment
      where enrollment.course_id = new.course_id
        and enrollment.status = 'ACTIVE'
        and (enrollment.expires_at is null or enrollment.expires_at > now())
    loop
      perform public.notify_user(
        registration.student_id,
        'New live class scheduled',
        'A new session, "' || new.title || '", is available in your course.',
        'LIVE_CLASS',
        '/student/live-classes'
      );
    end loop;
  elsif old.status is distinct from new.status and new.status = 'CANCELLED' then
    for registration in
      select live_class_registration.student_id
      from public.live_class_registrations as live_class_registration
      where live_class_registration.live_class_id = new.id
        and live_class_registration.registration_status = 'REGISTERED'
    loop
      perform public.notify_user(
        registration.student_id,
        'Live class cancelled',
        'The instructor cancelled "' || new.title || '".',
        'LIVE_CLASS',
        '/student/live-classes'
      );
    end loop;
  elsif old.scheduled_start is distinct from new.scheduled_start
    or old.scheduled_end is distinct from new.scheduled_end then
    for registration in
      select live_class_registration.student_id
      from public.live_class_registrations as live_class_registration
      where live_class_registration.live_class_id = new.id
        and live_class_registration.registration_status = 'REGISTERED'
    loop
      perform public.notify_user(
        registration.student_id,
        'Live class schedule updated',
        'The schedule for "' || new.title || '" has changed.',
        'LIVE_CLASS',
        '/student/live-classes'
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists live_classes_notify_change on public.live_classes;
create trigger live_classes_notify_change
after insert or update of status, scheduled_start, scheduled_end on public.live_classes
for each row execute function public.notify_live_class_change();

drop policy if exists "Authorized users read live class details"
  on public.live_classes;
create policy "Authorized users read live class details"
on public.live_classes for select to authenticated
using (
  (select public.can_access_live_class(id))
  or (
    status = 'SCHEDULED'
    and scheduled_start > now()
    and (select public.can_access_course(course_id))
  )
);

grant select (max_participants, meeting_status) on public.live_classes to authenticated;

create or replace function public.record_live_class_attendance(
  target_live_class_id uuid,
  target_student_id uuid,
  attendance_result text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_row record;
begin
  if (select auth.uid()) is null
    or attendance_result not in ('ATTENDED', 'NO_SHOW') then
    raise insufficient_privilege using message = 'A valid attendance decision is required.';
  end if;

  select
    live_class.id,
    live_class.course_id,
    live_class.scheduled_end,
    live_class.status
  into class_row
  from public.live_classes as live_class
  where live_class.id = target_live_class_id
  for update;

  if not found
    or not (
      (select public.current_user_is_admin())
      or (select public.can_manage_course(class_row.course_id))
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  if class_row.scheduled_end > now() then
    raise check_violation using message = 'Attendance can be recorded after the class ends.';
  end if;
  if class_row.status = 'CANCELLED' then
    raise check_violation using message = 'Attendance cannot be recorded for a cancelled class.';
  end if;

  update public.live_class_registrations
  set registration_status = attendance_result,
      attendance_marked_by = (select auth.uid()),
      attendance_marked_at = now(),
      attendance_source = 'INSTRUCTOR'
  where live_class_id = target_live_class_id
    and student_id = target_student_id
    and registration_status = 'REGISTERED';

  if not found then
    raise check_violation using message = 'Only an active registration can be marked.';
  end if;

  insert into public.live_class_attendance_events (
    live_class_id,
    student_id,
    actor_id,
    attendance_result,
    attendance_source
  )
  values (
    target_live_class_id,
    target_student_id,
    (select auth.uid()),
    attendance_result,
    'INSTRUCTOR'
  );
end;
$$;

-- create function public.get_live_class_roster(target_live_class_id uuid)
create or replace function public.get_live_class_roster(target_live_class_id uuid)
returns table (
  student_id uuid,
  student_name text,
  registration_status text,
  registered_at timestamptz,
  attendance_marked_at timestamptz,
  attendance_source text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_course_id uuid;
begin
  select live_class.course_id
  into target_course_id
  from public.live_classes as live_class
  where live_class.id = target_live_class_id;

  if (select auth.uid()) is null
    or target_course_id is null
    or not (
      (select public.current_user_is_admin())
      or (select public.can_manage_course(target_course_id))
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  return query
  select
    registration.student_id,
    profile.full_name,
    registration.registration_status,
    registration.registered_at,
    registration.attendance_marked_at,
    registration.attendance_source
  from public.live_class_registrations as registration
  join public.profiles as profile on profile.id = registration.student_id
  where registration.live_class_id = target_live_class_id
  order by registration.registered_at asc;
end;
$$;

revoke all on function public.get_live_class_roster(uuid) from public, anon;
grant execute on function public.get_live_class_roster(uuid) to authenticated;
