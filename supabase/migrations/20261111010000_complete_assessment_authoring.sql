alter table public.quiz_questions
  drop constraint quiz_questions_question_type_check,
  add constraint quiz_questions_question_type_check check (
    question_type in (
      'SINGLE_CHOICE',
      'MULTIPLE_SELECT',
      'TRUE_FALSE',
      'FILL_IN_THE_BLANK',
      'SHORT_ANSWER',
      'LONG_ANSWER',
      'MATCHING'
    )
  ),
  drop constraint quiz_question_grading_mode_check,
  add constraint quiz_question_grading_mode_check check (
    (
      question_type = 'FILL_IN_THE_BLANK'
      and grading_mode in ('AUTO', 'MANUAL')
    )
    or (
      question_type in ('SHORT_ANSWER', 'LONG_ANSWER')
      and grading_mode = 'MANUAL'
    )
    or (
      question_type not in (
        'FILL_IN_THE_BLANK',
        'SHORT_ANSWER',
        'LONG_ANSWER'
      )
      and grading_mode = 'AUTO'
    )
  ),
  drop constraint quiz_question_short_answer_manual_check,
  add constraint quiz_question_short_answer_manual_check check (
    question_type not in ('SHORT_ANSWER', 'LONG_ANSWER')
    or grading_mode = 'MANUAL'
  );

alter table public.question_bank_items
  drop constraint question_bank_items_question_type_check,
  add constraint question_bank_items_question_type_check check (
    question_type in (
      'SINGLE_CHOICE',
      'MULTIPLE_SELECT',
      'TRUE_FALSE',
      'FILL_IN_THE_BLANK',
      'SHORT_ANSWER',
      'LONG_ANSWER',
      'MATCHING'
    )
  );

create function public.save_instructor_quiz_question_for_editor(
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
  p_question_options jsonb,
  p_difficulty text,
  p_resource_links jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_question_id uuid;
  storage_question_type text;
begin
  if p_question_type not in (
    'SINGLE_CHOICE',
    'MULTIPLE_SELECT',
    'TRUE_FALSE',
    'FILL_IN_THE_BLANK',
    'SHORT_ANSWER',
    'LONG_ANSWER',
    'MATCHING'
  ) then
    raise check_violation using message = 'Choose a supported question type.';
  end if;

  if p_question_type = 'LONG_ANSWER' and not p_manual_grading then
    raise check_violation using message = 'Long-answer questions require manual grading.';
  end if;

  storage_question_type := case
    when p_question_type = 'LONG_ANSWER' then 'SHORT_ANSWER'
    else p_question_type
  end;

  saved_question_id := public.save_instructor_quiz_question_with_metadata(
    target_course_id,
    target_quiz_id,
    target_question_id,
    p_question_text,
    storage_question_type,
    p_points,
    p_manual_grading,
    p_accepted_answers,
    p_case_sensitive,
    p_normalize_whitespace,
    p_explanation,
    p_question_options,
    p_difficulty,
    p_resource_links
  );

  if p_question_type = 'LONG_ANSWER' then
    update public.quiz_questions
    set question_type = 'LONG_ANSWER'
    where id = saved_question_id
      and quiz_id = target_quiz_id;
  end if;

  return saved_question_id;
end;
$$;

revoke all on function public.save_instructor_quiz_question_for_editor(
  uuid, uuid, uuid, text, text, numeric, boolean, text[], boolean,
  boolean, text, jsonb, text, jsonb
) from public, anon;
grant execute on function public.save_instructor_quiz_question_for_editor(
  uuid, uuid, uuid, text, text, numeric, boolean, text[], boolean,
  boolean, text, jsonb, text, jsonb
) to authenticated;

create or replace function public.save_quiz_answer(
  target_attempt_id uuid,
  target_question_id uuid,
  target_option_ids uuid[],
  target_answer_text text,
  target_is_flagged boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row record;
  question_row record;
  matching_payload jsonb;
  option_count integer;
  supplied_count integer;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;

  select attempt.quiz_id, attempt.expires_at, quiz.course_id
  into attempt_row
  from public.quiz_attempts as attempt
  join public.quizzes as quiz on quiz.id = attempt.quiz_id
  where attempt.id = target_attempt_id
    and attempt.student_id = (select auth.uid())
    and attempt.status = 'IN_PROGRESS'
  for update of attempt;

  if not found or not (select public.can_access_course(attempt_row.course_id)) then
    raise insufficient_privilege using message = 'This assessment attempt is unavailable.';
  end if;

  if attempt_row.expires_at is not null and now() >= attempt_row.expires_at then
    raise check_violation using message = 'The assessment time limit has elapsed.';
  end if;

  select question.question_type, question.answer_key
  into question_row
  from public.quiz_attempt_questions as item
  join public.quiz_questions as question on question.id = item.question_id
  where item.attempt_id = target_attempt_id
    and item.question_id = target_question_id;

  if not found then
    raise insufficient_privilege using message = 'This question is not part of the attempt.';
  end if;

  target_option_ids := coalesce(target_option_ids, '{}'::uuid[]);
  if cardinality(target_option_ids) > 100
    or (
      cardinality(target_option_ids) > 0
      and (
        question_row.question_type not in ('SINGLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE')
        or cardinality(target_option_ids) <> (
          select count(distinct supplied.option_id)
          from unnest(target_option_ids) as supplied(option_id)
        )
      )
    )
    or (
      question_row.question_type in ('SINGLE_CHOICE', 'TRUE_FALSE')
      and cardinality(target_option_ids) > 1
    )
    or (
      question_row.question_type in (
        'FILL_IN_THE_BLANK',
        'SHORT_ANSWER',
        'LONG_ANSWER',
        'MATCHING'
      )
      and cardinality(target_option_ids) > 0
    ) then
    raise check_violation using message = 'The answer format is invalid for this question.';
  end if;

  select count(*)::integer
  into option_count
  from public.question_options as option
  where option.question_id = target_question_id
    and option.id = any(target_option_ids);

  supplied_count := cardinality(target_option_ids);
  if option_count <> supplied_count then
    raise check_violation using message = 'One or more selected options are invalid.';
  end if;

  if target_answer_text is not null and char_length(target_answer_text) > 10000 then
    raise check_violation using message = 'The answer is too long.';
  end if;
  if question_row.question_type in ('SINGLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE')
    and nullif(target_answer_text, '') is not null then
    raise check_violation using message = 'This question accepts option selections only.';
  end if;

  if question_row.question_type = 'MATCHING'
    and nullif(target_answer_text, '') is not null then
    begin
      matching_payload := target_answer_text::jsonb;
    exception when invalid_text_representation then
      raise check_violation using message = 'The matching answer format is invalid.';
    end;

    if jsonb_typeof(matching_payload) is distinct from 'object'
      or exists (
        select 1
        from jsonb_each(matching_payload) as pair(prompt_id, answer_text)
        where jsonb_typeof(pair.answer_text) is distinct from 'string'
          or not exists (
            select 1
            from public.question_options as option
            where option.question_id = target_question_id
              and option.id::text = pair.prompt_id
          )
          or not exists (
            select 1
            from jsonb_array_elements_text(question_row.answer_key::jsonb) as answer(value)
            where answer.value = pair.answer_text #>> '{}'
          )
      )
      or (
        select count(*) <> count(distinct pair.answer_text #>> '{}')
        from jsonb_each(matching_payload) as pair(prompt_id, answer_text)
      ) then
      raise check_violation using message = 'The matching answer format is invalid.';
    end if;
  end if;

  update public.quiz_answers as answer
  set selected_option_ids = target_option_ids,
    answer_text = nullif(target_answer_text, ''),
    awarded_points = null
  where answer.attempt_id = target_attempt_id
    and answer.question_id = target_question_id;

  update public.quiz_attempt_questions as item
  set is_flagged = coalesce(target_is_flagged, false)
  where item.attempt_id = target_attempt_id
    and item.question_id = target_question_id;
end;
$$;

create function public.reorder_instructor_quiz_questions(
  target_course_id uuid,
  target_quiz_id uuid,
  ordered_question_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  assessment_published boolean;
  question_count integer;
  supplied_count integer;
  position_offset integer;
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
    raise check_violation using message = 'Unpublish the assessment before reordering its questions.';
  end if;
  if exists (
    select 1
    from public.quiz_attempts as attempt
    where attempt.quiz_id = target_quiz_id
  ) then
    raise check_violation using message = 'Assessment questions cannot change after an attempt has started.';
  end if;
  if ordered_question_ids is null
    or cardinality(ordered_question_ids) > 100 then
    raise check_violation using message = 'The question order is invalid.';
  end if;

  select count(*)::integer, coalesce(max(question.position), -1) + 1
  into question_count, position_offset
  from public.quiz_questions as question
  where question.quiz_id = target_quiz_id;

  supplied_count := cardinality(ordered_question_ids);
  if supplied_count <> question_count
    or supplied_count <> (
      select count(distinct supplied.question_id)
      from unnest(ordered_question_ids) as supplied(question_id)
    )
    or exists (
      select 1
      from unnest(ordered_question_ids) as supplied(question_id)
      where not exists (
        select 1
        from public.quiz_questions as question
        where question.id = supplied.question_id
          and question.quiz_id = target_quiz_id
      )
    ) then
    raise check_violation using message = 'The question order must include every assessment question exactly once.';
  end if;

  update public.quiz_questions as question
  set position = question.position + position_offset + 1
  where question.quiz_id = target_quiz_id;

  update public.quiz_questions as question
  set position = (ordered.ordinality - 1)::integer
  from unnest(ordered_question_ids) with ordinality
    as ordered(question_id, ordinality)
  where question.id = ordered.question_id
    and question.quiz_id = target_quiz_id;
end;
$$;

revoke all on function public.reorder_instructor_quiz_questions(
  uuid, uuid, uuid[]
) from public, anon;
grant execute on function public.reorder_instructor_quiz_questions(
  uuid, uuid, uuid[]
) to authenticated;
