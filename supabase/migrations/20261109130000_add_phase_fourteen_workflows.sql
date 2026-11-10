alter table public.certificates
  add column revoked_at timestamptz,
  add column revoked_by uuid references public.profiles (id) on delete restrict,
  add column revocation_reason text;

alter table public.certificates
  add constraint certificates_revocation_state_check
  check (
    (status = 'ISSUED' and revoked_at is null and revoked_by is null and revocation_reason is null)
    or (
      status = 'REVOKED'
      and revoked_at is not null
      and revoked_by is not null
      and char_length(btrim(revocation_reason)) between 10 and 1000
    )
  );

create table public.certificate_events (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null check (event_type in ('ISSUED', 'REVOKED')),
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);

create index certificate_events_certificate_created_idx
  on public.certificate_events (certificate_id, created_at desc);

drop function if exists public.revoke_course_certificate(uuid);

alter table public.certificate_events enable row level security;
revoke all on public.certificate_events from public, anon, authenticated;
grant select on public.certificate_events to authenticated;

create policy "Administrators read certificate events"
on public.certificate_events for select to authenticated
using ((select public.current_user_is_admin()));

create function public.capture_certificate_event()
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

create trigger certificates_capture_event
after insert or update of status on public.certificates
for each row execute function public.capture_certificate_event();

revoke all on function public.capture_certificate_event() from public, anon, authenticated;

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

create or replace function public.revoke_course_certificate(
  target_certificate_id uuid,
  revocation_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  certificate_row record;
  normalized_reason text;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required.';
  end if;

  normalized_reason := btrim(coalesce(revocation_reason, ''));
  if char_length(normalized_reason) < 10
    or char_length(normalized_reason) > 1000 then
    raise check_violation using message = 'Provide a revocation reason of 10 to 1000 characters.';
  end if;

  select certificate.id, certificate.course_id, certificate.status
  into certificate_row
  from public.certificates as certificate
  where certificate.id = target_certificate_id
  for update;

  if not found
    or not (
      (select public.current_user_is_admin())
      or (select public.can_manage_course(certificate_row.course_id))
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  if certificate_row.status <> 'ISSUED' then
    raise check_violation using message = 'Only an issued certificate can be revoked.';
  end if;

  update public.certificates
  set status = 'REVOKED',
      revoked_at = now(),
      revoked_by = (select auth.uid()),
      revocation_reason = normalized_reason
  where id = target_certificate_id;
end;
$$;

drop function if exists public.verify_certificate(text);
create function public.verify_certificate(target_verification_code text)
returns table (
  certificate_number text,
  course_title text,
  student_name text,
  issued_at timestamptz,
  status text,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    certificate.certificate_number,
    course.title,
    profile.full_name,
    certificate.issued_at,
    certificate.status,
    certificate.revoked_at
  from public.certificates as certificate
  join public.courses as course on course.id = certificate.course_id
  join public.profiles as profile on profile.id = certificate.student_id
  where certificate.verification_code = target_verification_code
    and char_length(target_verification_code) between 32 and 64;
$$;

revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;
revoke all on function public.issue_course_certificate(uuid) from public, anon;
grant execute on function public.issue_course_certificate(uuid) to authenticated;
revoke all on function public.revoke_course_certificate(uuid, text) from public, anon;
grant execute on function public.revoke_course_certificate(uuid, text) to authenticated;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  course_updates boolean not null default true,
  assessment_updates boolean not null default true,
  certificate_updates boolean not null default true,
  live_class_updates boolean not null default true,
  billing_updates boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
grant select, insert, update on public.notification_preferences to authenticated;

create policy "Users manage their own notification preferences"
on public.notification_preferences for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter table public.notifications
  drop constraint if exists notifications_notification_type_check,
  add constraint notifications_notification_type_check
    check (
      notification_type in (
        'SYSTEM',
        'COURSE',
        'ASSESSMENT',
        'BILLING',
        'LIVE_CLASS',
        'ACCOUNT',
        'CERTIFICATE'
      )
    );

drop policy if exists "Users read their own notifications" on public.notifications;
create policy "Users read their own notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create function public.notify_user(
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

revoke all on function public.notify_user(uuid, text, text, text, text)
  from public, anon, authenticated;

create function public.notify_enrollment_change()
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

create trigger enrollments_notify_change
after insert or update of status on public.enrollments
for each row execute function public.notify_enrollment_change();

create function public.notify_certificate_issued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_user(
    new.student_id,
    'Certificate issued',
    'Your course certificate is ready to download from achievements.',
    'CERTIFICATE',
    '/student/achievements'
  );
  return new;
end;
$$;

create trigger certificates_notify_issued
after insert on public.certificates
for each row execute function public.notify_certificate_issued();

create function public.notify_assessment_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  course_title text;
begin
  if new.status = 'GRADED'
    and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select course.title
    into course_title
    from public.quizzes as quiz
    join public.courses as course on course.id = quiz.course_id
    where quiz.id = new.quiz_id;

    perform public.notify_user(
      new.student_id,
      'Assessment result available',
      'A graded result is available for ' || coalesce(course_title, 'your course') || '.',
      'ASSESSMENT',
      '/student/assessments'
    );
  end if;
  return new;
end;
$$;

create trigger quiz_attempts_notify_result
after insert or update of status on public.quiz_attempts
for each row execute function public.notify_assessment_result();

create function public.notify_payment_lifecycle()
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

create trigger payments_notify_lifecycle
after insert or update of status on public.payments
for each row execute function public.notify_payment_lifecycle();

create function public.notify_subscription_lifecycle()
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

create trigger subscriptions_notify_lifecycle
after insert or update of status on public.subscriptions
for each row execute function public.notify_subscription_lifecycle();

create function public.notify_live_class_change()
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

create trigger live_classes_notify_change
after insert or update of status, scheduled_start, scheduled_end on public.live_classes
for each row execute function public.notify_live_class_change();

revoke all on function public.notify_enrollment_change() from public, anon, authenticated;
revoke all on function public.notify_certificate_issued() from public, anon, authenticated;
revoke all on function public.notify_assessment_result() from public, anon, authenticated;
revoke all on function public.notify_payment_lifecycle() from public, anon, authenticated;
revoke all on function public.notify_subscription_lifecycle() from public, anon, authenticated;
revoke all on function public.notify_live_class_change() from public, anon, authenticated;

alter table public.live_classes
  alter column meeting_reference drop not null,
  add column max_participants integer check (
    max_participants is null or max_participants between 1 and 1000
  ),
  add column meeting_status text not null default 'HOST_PROVIDED' check (
    meeting_status in ('UNCONFIGURED', 'HOST_PROVIDED', 'CONFIRMED', 'FAILED')
  ),
  add column provider_meeting_id text;

alter table public.live_classes
  drop constraint if exists live_classes_status_check,
  add constraint live_classes_status_check
    check (status in ('DRAFT', 'SCHEDULED', 'CANCELLED', 'COMPLETED')),
  drop constraint if exists live_classes_meeting_reference_check,
  add constraint live_classes_meeting_reference_check
    check (
      meeting_reference is null
      or char_length(btrim(meeting_reference)) between 1 and 2048
    ),
  add constraint live_classes_scheduled_meeting_check
    check (status <> 'SCHEDULED' or meeting_reference is not null);

alter table public.live_class_registrations
  add column attendance_marked_by uuid references public.profiles (id) on delete set null,
  add column attendance_marked_at timestamptz,
  add column attendance_source text check (
    attendance_source is null or attendance_source in ('INSTRUCTOR', 'PROVIDER')
  ),
  add constraint live_class_attendance_state_check
    check (
      (attendance_marked_by is null
        and attendance_marked_at is null
        and attendance_source is null)
      or
      (registration_status in ('ATTENDED', 'NO_SHOW')
        and attendance_marked_by is not null
        and attendance_marked_at is not null
        and attendance_source is not null)
    );

grant select (max_participants, meeting_status) on public.live_classes to authenticated;

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

create table public.live_class_attendance_events (
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

create index live_class_attendance_events_class_created_idx
  on public.live_class_attendance_events (live_class_id, created_at desc);
alter table public.live_class_attendance_events enable row level security;
revoke all on public.live_class_attendance_events from public, anon, authenticated;
grant select on public.live_class_attendance_events to authenticated;

create policy "Administrators read live class attendance history"
on public.live_class_attendance_events for select to authenticated
using ((select public.current_user_is_admin()));

grant insert (max_participants) on public.live_classes to authenticated;
grant update (max_participants) on public.live_classes to authenticated;
revoke insert on public.live_class_registrations from authenticated;
drop policy if exists "Eligible students register for live classes"
  on public.live_class_registrations;

create or replace function public.get_live_class_meeting_reference(target_live_class_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  meeting_reference_value text;
begin
  if (select auth.uid()) is null
    or not (select public.can_access_live_class(target_live_class_id)) then
    raise insufficient_privilege using message = 'Live class registration is required.';
  end if;

  select live_class.meeting_reference
  into meeting_reference_value
  from public.live_classes as live_class
  where live_class.id = target_live_class_id
    and live_class.status = 'SCHEDULED'
    and live_class.meeting_reference is not null
    and live_class.meeting_status in ('HOST_PROVIDED', 'CONFIRMED');

  if not found then
    raise no_data_found using message = 'The live class meeting is unavailable.';
  end if;

  return meeting_reference_value;
end;
$$;

create function public.register_for_live_class(target_live_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_row record;
  registration_id uuid;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended((select auth.uid())::text, 0)
  );

  select
    live_class.id,
    live_class.course_id,
    live_class.title,
    live_class.scheduled_start,
    live_class.scheduled_end,
    live_class.max_participants
  into class_row
  from public.live_classes as live_class
  where live_class.id = target_live_class_id
    and live_class.status = 'SCHEDULED'
    and live_class.scheduled_start > now()
    and live_class.meeting_reference is not null
    and live_class.meeting_status in ('HOST_PROVIDED', 'CONFIRMED')
    and (select public.can_access_course(live_class.course_id))
  for update;

  if not found then
    raise insufficient_privilege using message = 'This class is not available for registration.';
  end if;

  if exists (
    select 1
    from public.live_class_registrations as registration
    join public.live_classes as existing_class
      on existing_class.id = registration.live_class_id
    where registration.student_id = (select auth.uid())
      and registration.registration_status = 'REGISTERED'
      and existing_class.status = 'SCHEDULED'
      and existing_class.scheduled_start < class_row.scheduled_end
      and existing_class.scheduled_end > class_row.scheduled_start
      and existing_class.id <> class_row.id
  ) then
    raise check_violation using message = 'This class overlaps another registered session.';
  end if;

  if class_row.max_participants is not null
    and (
      select count(*)
      from public.live_class_registrations as registration
      where registration.live_class_id = class_row.id
        and registration.registration_status = 'REGISTERED'
    ) >= class_row.max_participants then
    raise check_violation using message = 'This live class has reached capacity.';
  end if;

  insert into public.live_class_registrations (
    live_class_id,
    student_id,
    registration_status,
    registered_at
  )
  values (
    class_row.id,
    (select auth.uid()),
    'REGISTERED',
    now()
  )
  on conflict (live_class_id, student_id) do update
  set registration_status = 'REGISTERED',
      registered_at = now(),
      attendance_marked_by = null,
      attendance_marked_at = null,
      attendance_source = null
  where public.live_class_registrations.registration_status = 'CANCELLED'
  returning id into registration_id;

  if registration_id is null then
    raise check_violation using message = 'You are already registered for this live class.';
  end if;

  perform public.notify_user(
    (select auth.uid()),
    'Live class registration confirmed',
    'You are registered for "' || class_row.title || '".',
    'LIVE_CLASS',
    '/student/live-classes'
  );

  return registration_id;
end;
$$;

create function public.cancel_live_class_registration(target_live_class_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;

  update public.live_class_registrations as registration
  set registration_status = 'CANCELLED'
  from public.live_classes as live_class
  where registration.live_class_id = live_class.id
    and registration.live_class_id = target_live_class_id
    and registration.student_id = (select auth.uid())
    and registration.registration_status = 'REGISTERED'
    and live_class.scheduled_start > now()
    and live_class.status = 'SCHEDULED';

  if not found then
    raise no_data_found using message = 'The registration cannot be cancelled.';
  end if;
end;
$$;

create function public.record_live_class_attendance(
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

create function public.get_live_class_roster(target_live_class_id uuid)
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
  course_id uuid;
begin
  select live_class.course_id
  into course_id
  from public.live_classes as live_class
  where live_class.id = target_live_class_id;

  if (select auth.uid()) is null
    or course_id is null
    or not (
      (select public.current_user_is_admin())
      or (select public.can_manage_course(course_id))
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

revoke all on function public.get_live_class_meeting_reference(uuid) from public, anon;
grant execute on function public.get_live_class_meeting_reference(uuid) to authenticated;
revoke all on function public.register_for_live_class(uuid) from public, anon;
grant execute on function public.register_for_live_class(uuid) to authenticated;
revoke all on function public.cancel_live_class_registration(uuid) from public, anon;
grant execute on function public.cancel_live_class_registration(uuid) to authenticated;
revoke all on function public.record_live_class_attendance(uuid, uuid, text)
  from public, anon;
grant execute on function public.record_live_class_attendance(uuid, uuid, text)
  to authenticated;
revoke all on function public.get_live_class_roster(uuid) from public, anon;
grant execute on function public.get_live_class_roster(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;
