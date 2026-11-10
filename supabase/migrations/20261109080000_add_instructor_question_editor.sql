create function public.save_instructor_quiz_question(
  target_course_id uuid,
  target_quiz_id uuid,
  target_question_id uuid,
  p_question_text text,
  p_question_type text,
  p_points numeric,
  p_manual_grading boolean,
  p_accepted_answers text[],
  p_case_sensitive boolean,
  p_normalize_whitespace boolean,
  p_explanation text,
  p_question_options jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_question_id uuid;
  question_position integer;
  option_count integer;
  correct_count integer;
  assessment_published boolean;
begin
  if (select auth.uid()) is null
    or not (select public.can_manage_course(target_course_id)) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  select quiz.is_published
  into assessment_published
  from public.quizzes as quiz
  where quiz.id = target_quiz_id
    and quiz.course_id = target_course_id
  for update;

  if not found then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;
  if assessment_published then
    raise check_violation using message = 'Unpublish the assessment before changing its questions.';
  end if;

  if p_question_text is null
    or char_length(btrim(p_question_text)) not between 1 and 10000
    or (p_explanation is not null and char_length(p_explanation) > 10000)
    or p_question_type is null
    or p_question_type not in (
      'SINGLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE',
      'FILL_IN_THE_BLANK', 'SHORT_ANSWER'
    )
    or p_points is null or p_points <= 0 or p_points > 100000
    or p_accepted_answers is null
    or cardinality(p_accepted_answers) > 100
    or exists (
      select 1 from unnest(p_accepted_answers) as answer(value)
      where char_length(answer.value) > 1000
    )
    or p_question_options is null
    or jsonb_typeof(p_question_options) is distinct from 'array' then
    raise check_violation using message = 'The question details are invalid.';
  end if;
  if jsonb_array_length(p_question_options) > 50 then
    raise check_violation using message = 'A question can have at most 50 options.';
  end if;

  if p_question_type = 'SHORT_ANSWER' and not p_manual_grading then
    raise check_violation using message = 'Short-answer questions require manual grading.';
  end if;

  if p_question_type not in ('FILL_IN_THE_BLANK', 'SHORT_ANSWER')
    and p_manual_grading then
    raise check_violation using message = 'This question type does not support manual grading.';
  end if;

  if p_question_type = 'FILL_IN_THE_BLANK'
    and not p_manual_grading
    and not exists (
      select 1 from unnest(p_accepted_answers) as answer(value)
      where char_length(btrim(answer.value)) > 0
    ) then
    raise check_violation using message = 'Automatically graded fill-in questions need an accepted answer.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_question_options) as option(value)
    where jsonb_typeof(option.value -> 'option_text') is distinct from 'string'
      or jsonb_typeof(option.value -> 'is_correct') is distinct from 'boolean'
      or char_length(btrim(option.value ->> 'option_text')) not between 1 and 4000
  ) then
    raise check_violation using message = 'The question options are invalid.';
  end if;

  select count(*)::integer,
    count(*) filter (where (option.value ->> 'is_correct')::boolean)::integer
  into option_count, correct_count
  from jsonb_array_elements(p_question_options) as option(value);

  if p_question_type in ('SINGLE_CHOICE', 'MULTIPLE_SELECT')
    and (option_count < 2 or option_count > 50) then
    raise check_violation using message = 'Choice questions need between 2 and 50 options.';
  elsif p_question_type = 'SINGLE_CHOICE' and correct_count <> 1 then
    raise check_violation using message = 'Single-choice questions need exactly one correct option.';
  elsif p_question_type = 'MULTIPLE_SELECT' and correct_count < 1 then
    raise check_violation using message = 'Multiple-select questions need at least one correct option.';
  elsif p_question_type = 'TRUE_FALSE'
    and (option_count <> 2 or correct_count <> 1) then
    raise check_violation using message = 'True/false questions need two options and one correct answer.';
  elsif p_question_type in ('FILL_IN_THE_BLANK', 'SHORT_ANSWER')
    and option_count <> 0 then
    raise check_violation using message = 'Written-response questions cannot have choice options.';
  end if;

  if exists (
    select 1
    from public.quiz_attempts as attempt
    where attempt.quiz_id = target_quiz_id
  ) then
    raise check_violation using message = 'Assessment questions cannot change after an attempt has started.';
  end if;

  if target_question_id is not null then
    select question.id, question.position
    into saved_question_id, question_position
    from public.quiz_questions as question
    where question.id = target_question_id
      and question.quiz_id = target_quiz_id;

    if saved_question_id is null then
      raise insufficient_privilege using message = 'The question is unavailable.';
    end if;
  else
    select coalesce(max(question.position), -1) + 1
    into question_position
    from public.quiz_questions as question
    where question.quiz_id = target_quiz_id;
  end if;

  if target_question_id is null then
    insert into public.quiz_questions (
      quiz_id, question_text, question_type, explanation, points, position,
      grading_mode, answer_key, accepted_answers, case_sensitive,
      normalize_whitespace
    )
    values (
      target_quiz_id,
      p_question_text,
      p_question_type,
      p_explanation,
      p_points,
      question_position,
      case when p_manual_grading then 'MANUAL' else 'AUTO' end,
      case when p_question_type = 'FILL_IN_THE_BLANK' and not p_manual_grading
        then p_accepted_answers[1] else null end,
      case when p_question_type = 'FILL_IN_THE_BLANK' and not p_manual_grading
        then p_accepted_answers else '{}'::text[] end,
      p_case_sensitive,
      p_normalize_whitespace
    )
    returning id into saved_question_id;
  else
    update public.quiz_questions
    set question_text = p_question_text,
      question_type = p_question_type,
      explanation = p_explanation,
      points = p_points,
      grading_mode = case when p_manual_grading then 'MANUAL' else 'AUTO' end,
      answer_key = case
        when p_question_type = 'FILL_IN_THE_BLANK'
          and not p_manual_grading then p_accepted_answers[1]
        else null
      end,
      accepted_answers = case
        when p_question_type = 'FILL_IN_THE_BLANK'
          and not p_manual_grading then p_accepted_answers
        else '{}'::text[]
      end,
      case_sensitive = p_case_sensitive,
      normalize_whitespace = p_normalize_whitespace
    where id = saved_question_id
      and quiz_id = target_quiz_id;
  end if;

  delete from public.question_options
  where question_id = saved_question_id;

  insert into public.question_options (
    question_id, option_text, position, is_correct
  )
  select
    saved_question_id,
    option.value ->> 'option_text',
    (option.ordinality - 1)::integer,
    (option.value ->> 'is_correct')::boolean
  from jsonb_array_elements(p_question_options) with ordinality
    as option(value, ordinality);

  return saved_question_id;
end;
$$;

revoke all on function public.save_instructor_quiz_question(
  uuid, uuid, uuid, text, text, numeric, boolean, text[], boolean,
  boolean, text, jsonb
) from public, anon;
grant execute on function public.save_instructor_quiz_question(
  uuid, uuid, uuid, text, text, numeric, boolean, text[], boolean,
  boolean, text, jsonb
) to authenticated;

drop function public.get_quiz_answer_key(uuid);

create function public.get_quiz_answer_key(target_quiz_id uuid)
returns table (
  question_id uuid,
  grading_mode text,
  answer_key text,
  explanation text,
  correct_option_ids uuid[],
  accepted_answers text[],
  case_sensitive boolean,
  normalize_whitespace boolean
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
    ),
    question.accepted_answers,
    question.case_sensitive,
    question.normalize_whitespace
  from public.quiz_questions as question
  left join public.question_options as option
    on option.question_id = question.id
  where question.quiz_id = target_quiz_id
  group by question.id;
end;
$$;

revoke all on function public.get_quiz_answer_key(uuid) from public, anon;
grant execute on function public.get_quiz_answer_key(uuid) to authenticated;
