create or replace function public.capture_certificate_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'ISSUED' then
    insert into public.certificate_events (
      certificate_id,
      actor_id,
      event_type
    )
    values (new.id, auth.uid(), 'ISSUED');
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'REVOKED' then
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

insert into public.certificate_events (
  certificate_id,
  actor_id,
  event_type,
  created_at
)
select certificate.id, null, 'ISSUED', certificate.issued_at
from public.certificates as certificate
where not exists (
  select 1
  from public.certificate_events as event
  where event.certificate_id = certificate.id
    and event.event_type = 'ISSUED'
);

create or replace function public.issue_eligible_certificate_internal(
  target_enrollment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_row record;
  eligibility jsonb;
  certificate_id uuid := gen_random_uuid();
  certificate_number text;
  verification_code text := replace(gen_random_uuid()::text, '-', '');
begin
  select enrollment.student_id, enrollment.course_id, enrollment.status
  into enrollment_row
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id
  for update;

  if not found or enrollment_row.status <> 'COMPLETED' then
    return null;
  end if;

  eligibility := public.course_certificate_eligibility(target_enrollment_id);
  if not coalesce((eligibility ->> 'eligible')::boolean, false) then
    return null;
  end if;

  certificate_number :=
    'LP-' || upper(replace(certificate_id::text, '-', ''));

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
  )
  on conflict (enrollment_id) do nothing;

  if not found then
    select certificate.id
    into certificate_id
    from public.certificates as certificate
    where certificate.enrollment_id = target_enrollment_id;
  end if;

  return certificate_id;
end;
$$;

revoke all on function public.issue_eligible_certificate_internal(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.issue_course_certificate(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.auto_complete_certificate_enrollment(
  target_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_row record;
  eligibility jsonb;
begin
  select enrollment.id, enrollment.status, enrollment.expires_at
  into enrollment_row
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id
  for update;

  if not found
    or enrollment_row.status not in ('ACTIVE', 'COMPLETED')
    or (
      enrollment_row.status = 'ACTIVE'
      and enrollment_row.expires_at is not null
      and enrollment_row.expires_at <= now()
    ) then
    return;
  end if;

  eligibility := public.course_certificate_eligibility(target_enrollment_id);
  if not coalesce((eligibility ->> 'learning_complete')::boolean, false) then
    return;
  end if;

  if enrollment_row.status = 'ACTIVE' then
    update public.enrollments
    set status = 'COMPLETED'
    where id = target_enrollment_id
      and status = 'ACTIVE';
  else
    perform public.issue_eligible_certificate_internal(target_enrollment_id);
  end if;
end;
$$;

revoke all on function public.auto_complete_certificate_enrollment(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.auto_complete_course_certificate_enrollments(
  target_course_id uuid,
  target_student_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_row record;
begin
  for enrollment_row in
    select enrollment.id
    from public.enrollments as enrollment
    where enrollment.course_id = target_course_id
      and enrollment.status in ('ACTIVE', 'COMPLETED')
      and (
        target_student_id is null
        or enrollment.student_id = target_student_id
      )
    order by enrollment.id
  loop
    perform public.auto_complete_certificate_enrollment(enrollment_row.id);
  end loop;
end;
$$;

revoke all on function public.auto_complete_course_certificate_enrollments(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.auto_complete_from_lesson_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_course_id uuid;
begin
  if new.status <> 'COMPLETED' then
    return new;
  end if;

  select section.course_id
  into affected_course_id
  from public.lessons as lesson
  join public.course_sections as section on section.id = lesson.section_id
  where lesson.id = new.lesson_id;

  if affected_course_id is not null then
    perform public.auto_complete_course_certificate_enrollments(
      affected_course_id,
      new.student_id
    );
  end if;

  return new;
end;
$$;

create trigger lesson_progress_auto_issue_certificate
after insert or update of status on public.lesson_progress
for each row
when (new.status = 'COMPLETED')
execute function public.auto_complete_from_lesson_progress();

revoke all on function public.auto_complete_from_lesson_progress()
  from public, anon, authenticated, service_role;

create or replace function public.auto_complete_from_quiz_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_course_id uuid;
begin
  if new.status <> 'GRADED' then
    return new;
  end if;

  select quiz.course_id
  into affected_course_id
  from public.quizzes as quiz
  where quiz.id = new.quiz_id;

  if affected_course_id is not null then
    perform public.auto_complete_course_certificate_enrollments(
      affected_course_id,
      new.student_id
    );
  end if;

  return new;
end;
$$;

create trigger quiz_attempts_auto_issue_certificate
after insert or update of status, score, total_points on public.quiz_attempts
for each row
when (new.status = 'GRADED')
execute function public.auto_complete_from_quiz_attempt();

revoke all on function public.auto_complete_from_quiz_attempt()
  from public, anon, authenticated, service_role;

create or replace function public.auto_issue_on_enrollment_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'COMPLETED' then
    perform public.issue_eligible_certificate_internal(new.id);
  end if;
  return new;
end;
$$;

create trigger enrollments_auto_issue_certificate
after insert or update of status on public.enrollments
for each row
when (new.status = 'COMPLETED')
execute function public.auto_issue_on_enrollment_completion();

revoke all on function public.auto_issue_on_enrollment_completion()
  from public, anon, authenticated, service_role;

create or replace function public.auto_complete_after_certificate_policy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.auto_complete_course_certificate_enrollments(new.course_id);
  return new;
end;
$$;

create trigger certificate_requirements_auto_issue
after insert or update of
  required_lesson_completion_percent,
  require_required_assessments,
  require_final_exam,
  minimum_final_exam_score
on public.course_certificate_requirements
for each row
execute function public.auto_complete_after_certificate_policy_change();

create trigger quizzes_auto_issue_after_policy_change
after insert or update of
  is_published,
  passing_score,
  is_required,
  required_for_certificate,
  assessment_scope
on public.quizzes
for each row
execute function public.auto_complete_after_certificate_policy_change();

revoke all on function public.auto_complete_after_certificate_policy_change()
  from public, anon, authenticated, service_role;

create or replace function public.auto_complete_after_lesson_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_course_id uuid;
begin
  select section.course_id
  into affected_course_id
  from public.course_sections as section
  where section.id = new.section_id;

  if affected_course_id is not null then
    perform public.auto_complete_course_certificate_enrollments(affected_course_id);
  end if;

  return new;
end;
$$;

create trigger lessons_auto_issue_after_publication
after insert or update of is_published on public.lessons
for each row
execute function public.auto_complete_after_lesson_publication();

revoke all on function public.auto_complete_after_lesson_publication()
  from public, anon, authenticated, service_role;

revoke insert, update, delete on public.certificates
  from public, anon, authenticated, service_role;

do $$
declare
  enrollment_row record;
begin
  for enrollment_row in
    select enrollment.id
    from public.enrollments as enrollment
    where enrollment.status in ('ACTIVE', 'COMPLETED')
    order by enrollment.id
  loop
    perform public.auto_complete_certificate_enrollment(enrollment_row.id);
  end loop;
end;
$$;
