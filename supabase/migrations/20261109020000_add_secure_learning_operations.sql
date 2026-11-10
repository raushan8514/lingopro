create function public.start_quiz_attempt(target_quiz_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  quiz_row record;
  next_attempt_number integer;
  points_total numeric(9, 2);
  attempt_id uuid;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;

  select quiz.id, quiz.course_id, quiz.is_published, quiz.maximum_attempts
  into quiz_row
  from public.quizzes as quiz
  where quiz.id = target_quiz_id
  for update;

  if not found then
    raise insufficient_privilege using message = 'This quiz is not available.';
  end if;

  if not quiz_row.is_published
    or not (select public.can_access_course(quiz_row.course_id)) then
    raise insufficient_privilege using message = 'This quiz is not available.';
  end if;

  select count(*)::integer + 1
  into next_attempt_number
  from public.quiz_attempts as attempt
  where attempt.quiz_id = target_quiz_id
    and attempt.student_id = (select auth.uid());

  if quiz_row.maximum_attempts is not null
    and next_attempt_number > quiz_row.maximum_attempts then
    raise check_violation using message = 'The quiz attempt limit was reached.';
  end if;

  select coalesce(sum(question.points), 0)::numeric(9, 2)
  into points_total
  from public.quiz_questions as question
  where question.quiz_id = target_quiz_id;

  if points_total <= 0 then
    raise check_violation using message = 'The quiz has no gradable questions.';
  end if;

  insert into public.quiz_attempts (
    quiz_id,
    student_id,
    attempt_number,
    total_points
  )
  values (
    target_quiz_id,
    (select auth.uid()),
    next_attempt_number,
    points_total
  )
  returning id into attempt_id;

  return attempt_id;
end;
$$;

create function public.submit_quiz_attempt(target_attempt_id uuid)
returns table (
  attempt_id uuid,
  attempt_status text,
  awarded_score numeric,
  possible_points numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row record;
  answer_row record;
  correct_options uuid[];
  selected_options uuid[];
  selected_are_valid boolean;
  answer_is_correct boolean;
  has_manual_answers boolean := false;
  total_points_value numeric(9, 2);
  score_value numeric(9, 2);
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required.';
  end if;

  select
    attempt.id,
    attempt.quiz_id,
    attempt.student_id,
    attempt.started_at,
    quiz.course_id,
    quiz.time_limit_seconds
  into attempt_row
  from public.quiz_attempts as attempt
  join public.quizzes as quiz on quiz.id = attempt.quiz_id
  where attempt.id = target_attempt_id
    and attempt.student_id = (select auth.uid())
    and attempt.status = 'IN_PROGRESS'
  for update of attempt;

  if not found then
    raise insufficient_privilege using message = 'This quiz attempt is unavailable.';
  end if;

  if not (select public.current_user_has_role(array['student']))
    or not (select public.can_access_course(attempt_row.course_id)) then
    raise insufficient_privilege using message = 'This quiz attempt is unavailable.';
  end if;

  if attempt_row.time_limit_seconds is not null
    and now() > attempt_row.started_at
      + (interval '1 second' * attempt_row.time_limit_seconds) then
    raise check_violation using message = 'The quiz time limit has elapsed.';
  end if;

  select coalesce(sum(question.points), 0)::numeric(9, 2)
  into total_points_value
  from public.quiz_questions as question
  where question.quiz_id = attempt_row.quiz_id;

  if total_points_value <= 0 then
    raise check_violation using message = 'The quiz has no gradable questions.';
  end if;

  for answer_row in
    select
      answer.id,
      answer.selected_option_ids,
      answer.answer_text,
      question.id as question_id,
      question.question_type,
      question.grading_mode,
      question.answer_key,
      question.points
    from public.quiz_answers as answer
    join public.quiz_questions as question
      on question.id = answer.question_id
     and question.quiz_id = attempt_row.quiz_id
    where answer.attempt_id = target_attempt_id
    for update of answer
  loop
    if answer_row.grading_mode = 'MANUAL' then
      if answer_row.answer_text is not null
        or cardinality(answer_row.selected_option_ids) > 0 then
        has_manual_answers := true;
      end if;
      update public.quiz_answers
      set awarded_points = null
      where id = answer_row.id;
      continue;
    end if;

    answer_is_correct := false;

    if answer_row.question_type in ('SINGLE_CHOICE', 'TRUE_FALSE') then
      if cardinality(answer_row.selected_option_ids) = 1 then
        select exists (
          select 1
          from public.question_options as option
          where option.id = answer_row.selected_option_ids[1]
            and option.question_id = answer_row.question_id
            and option.is_correct
        )
        into answer_is_correct;
      end if;
    elsif answer_row.question_type = 'MULTIPLE_SELECT' then
      select
        coalesce(
          array_agg(option.id order by option.id)
            filter (where option.is_correct),
          '{}'::uuid[]
        )
      into correct_options
      from public.question_options as option
      where option.question_id = answer_row.question_id;

      select
        coalesce(array_agg(selected.option_id order by selected.option_id), '{}'::uuid[]),
        count(*) = count(distinct selected.option_id)
          and count(*) = (
            select count(*)
            from public.question_options as option
            where option.question_id = answer_row.question_id
              and option.id = any(answer_row.selected_option_ids)
          )
      into selected_options, selected_are_valid
      from unnest(answer_row.selected_option_ids) as selected(option_id);

      answer_is_correct := selected_are_valid
        and cardinality(selected_options) > 0
        and selected_options = correct_options;
    elsif answer_row.question_type = 'FILL_IN_THE_BLANK' then
      answer_is_correct :=
        lower(regexp_replace(btrim(coalesce(answer_row.answer_text, '')), '\s+', ' ', 'g'))
        =
        lower(regexp_replace(btrim(coalesce(answer_row.answer_key, '')), '\s+', ' ', 'g'))
        and nullif(btrim(coalesce(answer_row.answer_key, '')), '') is not null;
    end if;

    update public.quiz_answers
    set awarded_points = case when answer_is_correct then answer_row.points else 0 end
    where id = answer_row.id;
  end loop;

  select coalesce(sum(answer.awarded_points), 0)::numeric(9, 2)
  into score_value
  from public.quiz_answers as answer
  where answer.attempt_id = target_attempt_id;

  update public.quiz_attempts as attempt
  set
    total_points = total_points_value,
    score = score_value,
    status = case when has_manual_answers then 'PENDING_REVIEW' else 'GRADED' end,
    submitted_at = now()
  where attempt.id = target_attempt_id;

  return query
  select
    attempt.id,
    attempt.status,
    attempt.score,
    attempt.total_points
  from public.quiz_attempts as attempt
  where attempt.id = target_attempt_id;
end;
$$;

create function public.complete_course_enrollment(target_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_row record;
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
        where progress.student_id = (select auth.uid())
          and progress.lesson_id = lesson.id
          and progress.status = 'COMPLETED'
      )
  ) then
    raise check_violation using message = 'All published lessons must be completed.';
  end if;

  update public.enrollments
  set status = 'COMPLETED'
  where id = target_enrollment_id;
end;
$$;

create function public.grade_quiz_answer(
  target_answer_id uuid,
  points_awarded numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  answer_row record;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required.';
  end if;

  select
    answer.id,
    answer.attempt_id,
    attempt.quiz_id,
    attempt.status as attempt_status,
    question.points as maximum_points,
    question.grading_mode,
    quiz.course_id
  into answer_row
  from public.quiz_answers as answer
  join public.quiz_attempts as attempt on attempt.id = answer.attempt_id
  join public.quiz_questions as question on question.id = answer.question_id
  join public.quizzes as quiz on quiz.id = attempt.quiz_id
  where answer.id = target_answer_id
  for update of answer, attempt;

  if not found then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  if not (
      (select public.current_user_is_admin())
      or (select public.can_manage_course(answer_row.course_id))
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  if answer_row.attempt_status <> 'PENDING_REVIEW'
    or answer_row.grading_mode <> 'MANUAL' then
    raise check_violation using message = 'This answer is not awaiting manual grading.';
  end if;

  if points_awarded is null
    or points_awarded < 0
    or points_awarded > answer_row.maximum_points then
    raise check_violation using message = 'The awarded score is outside the allowed range.';
  end if;

  update public.quiz_answers
  set awarded_points = points_awarded
  where id = target_answer_id;

  if not exists (
    select 1
    from public.quiz_answers as answer
    join public.quiz_questions as question on question.id = answer.question_id
    where answer.attempt_id = answer_row.attempt_id
      and question.grading_mode = 'MANUAL'
      and answer.awarded_points is null
  ) then
    update public.quiz_attempts as attempt
    set
      score = (
        select coalesce(sum(answer.awarded_points), 0)
        from public.quiz_answers as answer
        where answer.attempt_id = answer_row.attempt_id
      ),
      status = 'GRADED'
    where attempt.id = answer_row.attempt_id;
  else
    update public.quiz_attempts as attempt
    set score = (
      select coalesce(sum(answer.awarded_points), 0)
      from public.quiz_answers as answer
      where answer.attempt_id = answer_row.attempt_id
    )
    where attempt.id = answer_row.attempt_id;
  end if;
end;
$$;

create function public.get_quiz_answer_key(target_quiz_id uuid)
returns table (
  question_id uuid,
  grading_mode text,
  answer_key text,
  explanation text,
  correct_option_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not exists (
      select 1
      from public.quizzes as quiz
      where quiz.id = target_quiz_id
        and (
          (select public.current_user_is_admin())
          or (select public.can_manage_course(quiz.course_id))
        )
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  return query
  select
    question.id,
    question.grading_mode,
    question.answer_key,
    question.explanation,
    coalesce(
      array_agg(option.id order by option.id)
        filter (where option.is_correct),
      '{}'::uuid[]
    )
  from public.quiz_questions as question
  left join public.question_options as option
    on option.question_id = question.id
  where question.quiz_id = target_quiz_id
  group by question.id;
end;
$$;

create function public.get_course_student_roster(target_course_id uuid)
returns table (
  student_id uuid,
  full_name text,
  enrollment_status text,
  enrolled_at timestamptz,
  expires_at timestamptz
)
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

  return query
  select
    enrollment.student_id,
    profile.full_name,
    enrollment.status,
    enrollment.enrolled_at,
    enrollment.expires_at
  from public.enrollments as enrollment
  join public.profiles as profile on profile.id = enrollment.student_id
  where enrollment.course_id = target_course_id
    and enrollment.status in ('ACTIVE', 'COMPLETED')
  order by enrollment.enrolled_at desc;
end;
$$;

create function public.issue_course_certificate(target_enrollment_id uuid)
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
  if (select auth.uid()) is null
    or not exists (
      select 1
      from public.enrollments as enrollment
      where enrollment.id = target_enrollment_id
        and (
          (select public.current_user_is_admin())
          or (select public.can_manage_course(enrollment.course_id))
        )
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  select enrollment.student_id, enrollment.course_id, enrollment.status
  into enrollment_row
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id
  for update;

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
    enrollment_row.student_id::text || '/' || certificate_id::text
  );

  return certificate_id;
end;
$$;

create function public.revoke_course_certificate(target_certificate_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  course_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required.';
  end if;

  select certificate.course_id
  into course_id
  from public.certificates as certificate
  where certificate.id = target_certificate_id
  for update;

  if not found
    or not (
      (select public.current_user_is_admin())
      or (select public.can_manage_course(course_id))
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  update public.certificates
  set status = 'REVOKED'
  where id = target_certificate_id;
end;
$$;

create function public.verify_certificate(target_verification_code text)
returns table (
  certificate_number text,
  course_title text,
  issued_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select certificate.certificate_number, course.title, certificate.issued_at
  from public.certificates as certificate
  join public.courses as course on course.id = certificate.course_id
  where certificate.verification_code = target_verification_code
    and certificate.status = 'ISSUED'
    and char_length(target_verification_code) between 32 and 64;
$$;

create function public.mark_notification_read(target_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required.';
  end if;

  update public.notifications
  set is_read = true, read_at = coalesce(read_at, now())
  where id = target_notification_id
    and user_id = (select auth.uid());

  if not found then
    raise no_data_found using message = 'The notification does not exist.';
  end if;
end;
$$;

create function public.create_admin_notification(
  target_user_id uuid,
  notification_title text,
  notification_message text,
  notification_kind text,
  notification_target_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_id uuid;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;

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
  )
  returning id into notification_id;

  return notification_id;
end;
$$;

create function public.get_live_class_meeting_reference(target_live_class_id uuid)
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
    and live_class.status = 'SCHEDULED';

  if not found then
    raise no_data_found using message = 'The live class is not available.';
  end if;

  return meeting_reference_value;
end;
$$;

revoke all on function public.start_quiz_attempt(uuid) from public, anon;
revoke all on function public.submit_quiz_attempt(uuid) from public, anon;
revoke all on function public.complete_course_enrollment(uuid) from public, anon;
revoke all on function public.grade_quiz_answer(uuid, numeric) from public, anon;
revoke all on function public.get_quiz_answer_key(uuid) from public, anon;
revoke all on function public.get_course_student_roster(uuid) from public, anon;
revoke all on function public.issue_course_certificate(uuid) from public, anon;
revoke all on function public.revoke_course_certificate(uuid) from public, anon;
revoke all on function public.verify_certificate(text) from public;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.create_admin_notification(uuid, text, text, text, text)
  from public, anon;
revoke all on function public.get_live_class_meeting_reference(uuid) from public, anon;

grant execute on function public.start_quiz_attempt(uuid) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;
grant execute on function public.complete_course_enrollment(uuid) to authenticated;
grant execute on function public.grade_quiz_answer(uuid, numeric) to authenticated;
grant execute on function public.get_quiz_answer_key(uuid) to authenticated;
grant execute on function public.get_course_student_roster(uuid) to authenticated;
grant execute on function public.issue_course_certificate(uuid) to authenticated;
grant execute on function public.revoke_course_certificate(uuid) to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.create_admin_notification(uuid, text, text, text, text)
  to authenticated;
grant execute on function public.get_live_class_meeting_reference(uuid)
  to authenticated;
