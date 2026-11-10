alter table public.quizzes
  add column assessment_scope text not null default 'COURSE'
    check (
      assessment_scope in (
        'COURSE',
        'LESSON_CHECKPOINT',
        'MODULE',
        'FINAL'
      )
    ),
  add column section_id uuid references public.course_sections (id) on delete restrict,
  add column is_required boolean not null default false,
  add column required_for_certificate boolean not null default false;

update public.quizzes as quiz
set assessment_scope = 'LESSON_CHECKPOINT'
where quiz.lesson_id is not null;

alter table public.quizzes
  add constraint quizzes_assessment_scope_location_check
  check (
    (assessment_scope = 'LESSON_CHECKPOINT'
      and lesson_id is not null and section_id is null)
    or (assessment_scope = 'MODULE'
      and lesson_id is null and section_id is not null)
    or (assessment_scope in ('COURSE', 'FINAL')
      and lesson_id is null and section_id is null)
  );

create index quizzes_course_scope_idx
  on public.quizzes (course_id, assessment_scope, section_id, is_published);

create table public.course_certificate_requirements (
  course_id uuid primary key references public.courses (id) on delete restrict,
  required_lesson_completion_percent numeric(5, 2) not null default 100
    check (required_lesson_completion_percent between 0 and 100),
  require_required_assessments boolean not null default true,
  require_final_exam boolean not null default false,
  minimum_final_exam_score numeric(5, 2) not null default 70
    check (minimum_final_exam_score between 0 and 100),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger course_certificate_requirements_set_updated_at
before update on public.course_certificate_requirements
for each row execute function public.set_updated_at();

alter table public.course_certificate_requirements enable row level security;
revoke all on public.course_certificate_requirements from public, anon, authenticated;
grant select, insert, update on public.course_certificate_requirements to authenticated;

create policy "Course managers manage certificate requirements"
on public.course_certificate_requirements for all to authenticated
using ((select public.can_manage_course(course_id)))
with check ((select public.can_manage_course(course_id)));

create or replace function public.validate_quiz_assessment_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lesson_id is not null and not exists (
    select 1
    from public.lessons as lesson
    join public.course_sections as section on section.id = lesson.section_id
    where lesson.id = new.lesson_id
      and section.course_id = new.course_id
  ) then
    raise foreign_key_violation using message = 'The checkpoint lesson must belong to the assessment course.';
  end if;

  if new.section_id is not null and not exists (
    select 1
    from public.course_sections as section
    where section.id = new.section_id
      and section.course_id = new.course_id
  ) then
    raise foreign_key_violation using message = 'The module must belong to the assessment course.';
  end if;

  if new.assessment_scope = 'LESSON_CHECKPOINT'
    and not exists (
      select 1 from public.lessons as lesson
      where lesson.id = new.lesson_id and lesson.is_published
    ) then
    raise check_violation using message = 'A lesson checkpoint requires a published lesson.';
  end if;

  return new;
end;
$$;

create trigger quizzes_validate_assessment_scope
before insert or update of course_id, lesson_id, section_id, assessment_scope
on public.quizzes
for each row execute function public.validate_quiz_assessment_scope();

revoke all on function public.validate_quiz_assessment_scope() from public, anon, authenticated;

create function public.enforce_assessment_prerequisites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quiz_row record;
  required_lesson_percent numeric(5, 2);
  lesson_count integer;
  completed_lesson_count integer;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  select quiz.course_id, quiz.assessment_scope, quiz.section_id, quiz.is_published
  into quiz_row
  from public.quizzes as quiz
  where quiz.id = new.quiz_id;
  if not found or not quiz_row.is_published then
    raise insufficient_privilege using message = 'The assessment is not available.';
  end if;

  if quiz_row.assessment_scope = 'MODULE' then
    if not exists (
      select 1
      from public.lessons as lesson
      where lesson.section_id = quiz_row.section_id
        and lesson.is_published
    ) or exists (
      select 1
      from public.lessons as lesson
      where lesson.section_id = quiz_row.section_id
        and lesson.is_published
        and not exists (
          select 1
          from public.lesson_progress as progress
          where progress.lesson_id = lesson.id
            and progress.student_id = new.student_id
            and progress.status = 'COMPLETED'
        )
    ) then
      raise check_violation using message = 'Complete the module lessons before starting its assessment.';
    end if;
  elsif quiz_row.assessment_scope = 'FINAL' then
    select coalesce(requirements.required_lesson_completion_percent, 100)
    into required_lesson_percent
    from (select 1) as defaults
    left join public.course_certificate_requirements as requirements
      on requirements.course_id = quiz_row.course_id;

    select
      count(*)::integer,
      count(*) filter (where progress.status = 'COMPLETED')::integer
    into lesson_count, completed_lesson_count
    from public.lessons as lesson
    join public.course_sections as section on section.id = lesson.section_id
    left join public.lesson_progress as progress
      on progress.lesson_id = lesson.id
     and progress.student_id = new.student_id
    where section.course_id = quiz_row.course_id
      and lesson.is_published;

    if lesson_count = 0
      or completed_lesson_count::numeric * 100 / lesson_count < required_lesson_percent
      or exists (
        select 1
        from public.quizzes as required_quiz
        where required_quiz.course_id = quiz_row.course_id
          and required_quiz.assessment_scope = 'MODULE'
          and required_quiz.is_published
          and (required_quiz.is_required or required_quiz.required_for_certificate)
          and not exists (
            select 1
            from public.quiz_attempts as attempt
            where attempt.quiz_id = required_quiz.id
              and attempt.student_id = new.student_id
              and attempt.status = 'GRADED'
              and attempt.total_points > 0
              and attempt.score / attempt.total_points * 100
                >= coalesce(required_quiz.passing_score, 0)
          )
      ) then
      raise check_violation using message = 'Complete required lessons and module assessments before the final examination.';
    end if;
  end if;

  return new;
end;
$$;

create trigger quiz_attempts_enforce_assessment_prerequisites
before insert on public.quiz_attempts
for each row execute function public.enforce_assessment_prerequisites();

revoke all on function public.enforce_assessment_prerequisites() from public, anon, authenticated;

create function public.prevent_assessment_scope_changes_after_attempts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    old.assessment_scope is distinct from new.assessment_scope
    or old.section_id is distinct from new.section_id
    or old.is_required is distinct from new.is_required
    or old.required_for_certificate is distinct from new.required_for_certificate
  ) and exists (
    select 1
    from public.quiz_attempts as attempt
    where attempt.quiz_id = old.id
  ) then
    raise check_violation using message = 'Assessment placement and requirements are immutable after attempts begin.';
  end if;
  return new;
end;
$$;

create trigger quizzes_prevent_scope_changes_after_attempts
before update of assessment_scope, section_id, is_required, required_for_certificate
on public.quizzes
for each row execute function public.prevent_assessment_scope_changes_after_attempts();

revoke all on function public.prevent_assessment_scope_changes_after_attempts() from public, anon, authenticated;

create or replace function public.course_certificate_eligibility(
  target_enrollment_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  enrollment_row record;
  requirement_row record;
  lesson_count integer;
  completed_lesson_count integer;
  lesson_percent numeric(5, 2);
  required_assessment_count integer;
  passed_assessment_count integer;
  final_exam_passed boolean := false;
  learning_complete boolean;
begin
  select enrollment.id, enrollment.student_id, enrollment.course_id, enrollment.status
  into enrollment_row
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id;

  if not found then
    return jsonb_build_object('available', false);
  end if;

  select
    coalesce(requirements.required_lesson_completion_percent, 100),
    coalesce(requirements.require_required_assessments, true),
    coalesce(requirements.require_final_exam, false),
    coalesce(requirements.minimum_final_exam_score, 70)
  into requirement_row
  from (select 1) as defaults
  left join public.course_certificate_requirements as requirements
    on requirements.course_id = enrollment_row.course_id;

  select
    count(*)::integer,
    count(*) filter (
      where progress.status = 'COMPLETED'
    )::integer
  into lesson_count, completed_lesson_count
  from public.lessons as lesson
  join public.course_sections as section on section.id = lesson.section_id
  left join public.lesson_progress as progress
    on progress.lesson_id = lesson.id
   and progress.student_id = enrollment_row.student_id
  where section.course_id = enrollment_row.course_id
    and lesson.is_published;

  lesson_percent := case
    when lesson_count = 0 then 0
    else round(completed_lesson_count::numeric * 100 / lesson_count, 2)
  end;

  select
    count(*)::integer,
    count(*) filter (where passed.has_passed)::integer
  into required_assessment_count, passed_assessment_count
  from public.quizzes as quiz
  left join lateral (
    select exists (
      select 1
      from public.quiz_attempts as attempt
      where attempt.quiz_id = quiz.id
        and attempt.student_id = enrollment_row.student_id
        and attempt.status = 'GRADED'
        and attempt.total_points > 0
        and attempt.score / attempt.total_points * 100
          >= coalesce(quiz.passing_score, 0)
    ) as has_passed
  ) as passed on true
  where quiz.course_id = enrollment_row.course_id
    and quiz.is_published
    and (
      quiz.is_required
      or quiz.required_for_certificate
      or quiz.passing_score is not null
    );

  select exists (
    select 1
    from public.quizzes as quiz
    join public.quiz_attempts as attempt
      on attempt.quiz_id = quiz.id
     and attempt.student_id = enrollment_row.student_id
     and attempt.status = 'GRADED'
     and attempt.total_points > 0
    where quiz.course_id = enrollment_row.course_id
      and quiz.assessment_scope = 'FINAL'
      and quiz.is_published
      and attempt.score / attempt.total_points * 100
        >= greatest(
          requirement_row.minimum_final_exam_score,
          coalesce(quiz.passing_score, 0)
        )
  ) into final_exam_passed;

  learning_complete :=
    lesson_count > 0
    and lesson_percent >= requirement_row.required_lesson_completion_percent
    and (
      not requirement_row.require_required_assessments
      or required_assessment_count = passed_assessment_count
    )
    and (
      not requirement_row.require_final_exam
      or final_exam_passed
    );

  return jsonb_build_object(
    'available', true,
    'enrollment_id', enrollment_row.id,
    'course_id', enrollment_row.course_id,
    'enrollment_status', enrollment_row.status,
    'eligible', enrollment_row.status = 'COMPLETED' and learning_complete,
    'learning_complete', learning_complete,
    'lesson_completion_percent', lesson_percent,
    'required_lesson_completion_percent', requirement_row.required_lesson_completion_percent,
    'completed_lessons', completed_lesson_count,
    'total_lessons', lesson_count,
    'required_assessments_passed', passed_assessment_count,
    'required_assessments_total', required_assessment_count,
    'require_final_exam', requirement_row.require_final_exam,
    'final_exam_passed', final_exam_passed,
    'minimum_final_exam_score', requirement_row.minimum_final_exam_score
  );
end;
$$;

revoke all on function public.course_certificate_eligibility(uuid) from public, anon, authenticated;

create function public.get_course_certificate_eligibility(target_enrollment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  eligibility jsonb;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required.';
  end if;

  select enrollment.student_id
  into owner_id
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id;

  if not found
    or not (
      owner_id = (select auth.uid())
      or (select public.current_user_is_admin())
      or exists (
        select 1
        from public.enrollments as enrollment
        where enrollment.id = target_enrollment_id
          and (select public.can_manage_course(enrollment.course_id))
      )
    ) then
    raise insufficient_privilege using message = 'Enrollment access is required.';
  end if;

  eligibility := public.course_certificate_eligibility(target_enrollment_id);
  return eligibility;
end;
$$;

revoke all on function public.get_course_certificate_eligibility(uuid) from public, anon;
grant execute on function public.get_course_certificate_eligibility(uuid) to authenticated;

create or replace function public.complete_course_enrollment(target_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_row record;
  eligibility jsonb;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;

  select enrollment.id, enrollment.course_id, enrollment.status, enrollment.expires_at
  into enrollment_row
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id
    and enrollment.student_id = (select auth.uid())
  for update;

  if not found then
    raise insufficient_privilege using message = 'The enrollment is unavailable.';
  end if;

  if enrollment_row.status <> 'ACTIVE'
    or (
      enrollment_row.expires_at is not null
      and enrollment_row.expires_at <= now()
    )
    or not (select public.can_access_course(enrollment_row.course_id)) then
    raise check_violation using message = 'The enrollment is not active.';
  end if;

  eligibility := public.course_certificate_eligibility(target_enrollment_id);
  if not coalesce((eligibility ->> 'learning_complete')::boolean, false) then
    raise check_violation using message = 'Required course learning and assessments must be complete.';
  end if;

  update public.enrollments
  set status = 'COMPLETED'
  where id = target_enrollment_id;
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
  eligibility jsonb;
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

  eligibility := public.course_certificate_eligibility(target_enrollment_id);
  if not coalesce((eligibility ->> 'eligible')::boolean, false) then
    raise check_violation using message = 'The enrollment does not satisfy the configured certificate requirements.';
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

revoke all on function public.complete_course_enrollment(uuid) from public, anon;
grant execute on function public.complete_course_enrollment(uuid) to authenticated;
revoke all on function public.issue_course_certificate(uuid) from public, anon;
grant execute on function public.issue_course_certificate(uuid) to authenticated;
