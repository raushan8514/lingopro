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
    coalesce(requirements.required_lesson_completion_percent, 100)
      as required_lesson_completion_percent,
    coalesce(requirements.require_required_assessments, true)
      as require_required_assessments,
    coalesce(requirements.require_final_exam, false)
      as require_final_exam,
    coalesce(requirements.minimum_final_exam_score, 70)
      as minimum_final_exam_score
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

revoke all on function public.course_certificate_eligibility(uuid)
  from public, anon, authenticated;
