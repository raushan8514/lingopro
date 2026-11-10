alter table public.quiz_questions
  drop constraint quiz_questions_question_type_check,
  add constraint quiz_questions_question_type_check check (
    question_type in (
      'SINGLE_CHOICE',
      'MULTIPLE_SELECT',
      'TRUE_FALSE',
      'FILL_IN_THE_BLANK',
      'SHORT_ANSWER',
      'MATCHING'
    )
  );

create or replace function public.save_instructor_quiz_question(
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
      'FILL_IN_THE_BLANK', 'SHORT_ANSWER', 'MATCHING'
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
  elsif p_question_type = 'MATCHING'
    and (
      option_count < 2
      or option_count > 20
      or correct_count <> 0
      or cardinality(p_accepted_answers) <> option_count
      or exists (
        select 1
        from jsonb_array_elements(p_question_options) as option(value)
        where (option.value ->> 'is_correct')::boolean
      )
      or exists (
        select 1
        from (
          select lower(btrim(option.value ->> 'option_text')) as value
          from jsonb_array_elements(p_question_options) as option(value)
        ) as prompts
        group by prompts.value
        having count(*) > 1
      )
      or exists (
        select 1
        from (
          select lower(btrim(answer.value)) as value
          from unnest(p_accepted_answers) as answer(value)
        ) as matches
        group by matches.value
        having count(*) > 1
      )
      or exists (
        select 1
        from unnest(p_accepted_answers) as answer(value)
        where char_length(btrim(answer.value)) not between 1 and 4000
      )
    ) then
    raise check_violation using message = 'Matching questions need 2–20 unique prompts and unique answers.';
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
      case
        when p_question_type = 'FILL_IN_THE_BLANK' and not p_manual_grading
          then p_accepted_answers[1]
        when p_question_type = 'MATCHING'
          then to_json(p_accepted_answers)::text
        else null
      end,
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
        when p_question_type = 'MATCHING'
          then to_json(p_accepted_answers)::text
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
      question_row.question_type in ('FILL_IN_THE_BLANK', 'SHORT_ANSWER', 'MATCHING')
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

create or replace function public.submit_quiz_attempt(target_attempt_id uuid)
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
  answer_is_present boolean;
  has_manual_answers boolean := false;
  total_points_value numeric(9, 2);
  score_value numeric(9, 2);
  awarded_value numeric(7, 2);
  accepted_answer text;
  normalized_answer text;
  matching_payload jsonb;
  matching_pair_count integer;
  matching_correct_count integer;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;

  select attempt.id, attempt.quiz_id, attempt.student_id, attempt.status,
    attempt.expires_at, quiz.course_id, quiz.allow_partial_credit,
    quiz.negative_marking
  into attempt_row
  from public.quiz_attempts as attempt
  join public.quizzes as quiz on quiz.id = attempt.quiz_id
  where attempt.id = target_attempt_id
    and attempt.student_id = (select auth.uid())
  for update of attempt;

  if not found or not (select public.can_access_course(attempt_row.course_id)) then
    raise insufficient_privilege using message = 'This assessment attempt is unavailable.';
  end if;

  if attempt_row.status <> 'IN_PROGRESS' then
    return query
      select attempt.id, attempt.status, attempt.score, attempt.total_points
      from public.quiz_attempts as attempt
      where attempt.id = target_attempt_id;
    return;
  end if;

  select coalesce(sum(question.points), 0)::numeric(9, 2)
  into total_points_value
  from public.quiz_questions as question
  where question.quiz_id = attempt_row.quiz_id;

  for answer_row in
    select answer.id, answer.selected_option_ids, answer.answer_text,
      question.id as question_id, question.question_type, question.grading_mode,
      question.answer_key, question.accepted_answers, question.case_sensitive,
      question.normalize_whitespace, question.points
    from public.quiz_answers as answer
    join public.quiz_attempt_questions as item
      on item.attempt_id = answer.attempt_id
     and item.question_id = answer.question_id
    join public.quiz_questions as question
      on question.id = answer.question_id
     and question.quiz_id = attempt_row.quiz_id
    where answer.attempt_id = target_attempt_id
    order by item.position
    for update of answer
  loop
    answer_is_present := cardinality(answer_row.selected_option_ids) > 0
      or nullif(btrim(coalesce(answer_row.answer_text, '')), '') is not null;
    if answer_row.grading_mode = 'MANUAL' then
      if answer_is_present then
        has_manual_answers := true;
        update public.quiz_answers set awarded_points = null where id = answer_row.id;
      else
        update public.quiz_answers set awarded_points = 0 where id = answer_row.id;
      end if;
      continue;
    end if;

    answer_is_correct := false;
    awarded_value := 0;

    if answer_row.question_type in ('SINGLE_CHOICE', 'TRUE_FALSE') then
      if cardinality(answer_row.selected_option_ids) = 1 then
        select exists (
          select 1 from public.question_options as option
          where option.id = answer_row.selected_option_ids[1]
            and option.question_id = answer_row.question_id
            and option.is_correct
        ) into answer_is_correct;
      end if;
    elsif answer_row.question_type = 'MULTIPLE_SELECT' then
      select coalesce(array_agg(option.id order by option.id), '{}'::uuid[])
      into correct_options
      from public.question_options as option
      where option.question_id = answer_row.question_id and option.is_correct;

      select coalesce(array_agg(selected.option_id order by selected.option_id), '{}'::uuid[]),
        count(*) = count(distinct selected.option_id)
          and count(*) = (
            select count(*) from public.question_options as option
            where option.question_id = answer_row.question_id
              and option.id = any(answer_row.selected_option_ids)
          )
      into selected_options, selected_are_valid
      from unnest(answer_row.selected_option_ids) as selected(option_id);

      answer_is_correct := selected_are_valid
        and cardinality(selected_options) > 0
        and selected_options = correct_options;

      if not answer_is_correct and attempt_row.allow_partial_credit
        and selected_are_valid and cardinality(selected_options) > 0 then
        select greatest(
          0,
          (
            count(*) filter (where option.is_correct and option.id = any(selected_options))
            - count(*) filter (where not option.is_correct and option.id = any(selected_options))
          )::numeric / nullif(count(*) filter (where option.is_correct), 0)
        )
        into awarded_value
        from public.question_options as option
        where option.question_id = answer_row.question_id;
        awarded_value := round(awarded_value * answer_row.points, 2);
      end if;
    elsif answer_row.question_type = 'FILL_IN_THE_BLANK' then
      normalized_answer := coalesce(answer_row.answer_text, '');
      if answer_row.normalize_whitespace then
        normalized_answer := regexp_replace(btrim(normalized_answer), '\s+', ' ', 'g');
      else
        normalized_answer := btrim(normalized_answer);
      end if;
      answer_is_correct := exists (
        select 1 from unnest(
          case
            when cardinality(answer_row.accepted_answers) > 0 then answer_row.accepted_answers
            else array[answer_row.answer_key]
          end
        ) as accepted(value)
        where (
          (
            answer_row.case_sensitive
            and (
              case
                when answer_row.normalize_whitespace then
                  regexp_replace(btrim(accepted.value), '\s+', ' ', 'g')
                else btrim(accepted.value)
              end
            ) = normalized_answer
          )
          or (
            not answer_row.case_sensitive
            and lower(
              case
                when answer_row.normalize_whitespace then
                  regexp_replace(btrim(accepted.value), '\s+', ' ', 'g')
                else btrim(accepted.value)
              end
            ) = lower(normalized_answer)
          )
        )
      );
    elsif answer_row.question_type = 'MATCHING' then
      matching_payload := case
        when nullif(answer_row.answer_text, '') is null then '{}'::jsonb
        else answer_row.answer_text::jsonb
      end;

      select
        count(*)::integer,
        count(*) filter (
          where matching_payload ->> option.id::text
            = answer_row.answer_key::jsonb ->> option.position
        )::integer
      into matching_pair_count, matching_correct_count
      from public.question_options as option
      where option.question_id = answer_row.question_id;

      answer_is_correct := matching_pair_count > 0
        and matching_correct_count = matching_pair_count;

      if not answer_is_correct
        and attempt_row.allow_partial_credit
        and matching_pair_count > 0 then
        awarded_value := round(
          answer_row.points * matching_correct_count / matching_pair_count,
          2
        );
      end if;
    end if;

    if answer_is_correct then
      awarded_value := answer_row.points;
    elsif answer_is_present then
      if answer_row.question_type = 'MULTIPLE_SELECT'
        and attempt_row.allow_partial_credit then
        awarded_value := awarded_value - attempt_row.negative_marking;
      elsif answer_row.question_type = 'MATCHING'
        and attempt_row.allow_partial_credit then
        awarded_value := greatest(0, awarded_value - attempt_row.negative_marking);
      else
        awarded_value := -attempt_row.negative_marking;
      end if;
    end if;

    update public.quiz_answers
    set awarded_points = awarded_value
    where id = answer_row.id;
  end loop;

  select coalesce(sum(answer.awarded_points), 0)::numeric(9, 2)
  into score_value
  from public.quiz_answers as answer
  where answer.attempt_id = target_attempt_id;

  update public.quiz_attempts as attempt
  set total_points = total_points_value,
    score = score_value,
    status = case when has_manual_answers then 'PENDING_REVIEW' else 'GRADED' end,
    submitted_at = now(),
    is_expired = attempt.expires_at is not null and now() >= attempt.expires_at
  where attempt.id = target_attempt_id;

  return query
    select attempt.id, attempt.status, attempt.score, attempt.total_points
    from public.quiz_attempts as attempt
    where attempt.id = target_attempt_id;
end;
$$;

create or replace function public.get_student_quiz_attempt(target_attempt_id uuid)
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
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;

  select jsonb_build_object(
    'id', attempt.id,
    'quiz_id', quiz.id,
    'title', quiz.title,
    'instructions', quiz.instructions,
    'assessment_type', quiz.assessment_type,
    'status', attempt.status,
    'score', attempt.score,
    'total_points', attempt.total_points,
    'passing_score', quiz.passing_score,
    'expires_at', attempt.expires_at,
    'server_time', now(),
    'is_expired', attempt.is_expired,
    'allow_result_review', quiz.allow_result_review,
    'show_correct_answers', quiz.show_correct_answers,
    'show_explanations', quiz.show_explanations,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', question.id,
        'question_text', question.question_text,
        'question_type', question.question_type,
        'points', question.points,
        'position', item.position,
        'is_flagged', item.is_flagged,
        'selected_option_ids', answer.selected_option_ids,
        'answer_text', answer.answer_text,
        'awarded_points', case when attempt.status = 'IN_PROGRESS' then null else answer.awarded_points end,
        'matching_choices', case
          when question.question_type = 'MATCHING'
            and attempt.status = 'IN_PROGRESS' then coalesce((
              select jsonb_agg(
                jsonb_build_object('value', choice.value, 'label', choice.value)
                order by md5(attempt.id::text || choice.value)
              )
              from jsonb_array_elements_text(question.answer_key::jsonb) as choice(value)
            ), '[]'::jsonb)
          else '[]'::jsonb
        end,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', option.id,
            'option_text', option.option_text,
            'is_correct', case
              when attempt.status <> 'IN_PROGRESS'
                and quiz.allow_result_review
                and quiz.show_correct_answers
                and question.question_type <> 'MATCHING' then option.is_correct
              else null
            end,
            'matching_answer', case
              when attempt.status <> 'IN_PROGRESS'
                and quiz.allow_result_review
                and quiz.show_correct_answers
                and question.question_type = 'MATCHING' then
                  question.answer_key::jsonb ->> option.position
              else null
            end,
            'selected_matching_answer', case
              when attempt.status <> 'IN_PROGRESS'
                and quiz.allow_result_review
                and question.question_type = 'MATCHING'
                and jsonb_typeof(answer.answer_text::jsonb) = 'object'
                then answer.answer_text::jsonb ->> option.id::text
              else null
            end
          ) order by ordered.option_position)
          from unnest(item.option_order) with ordinality as ordered(option_id, option_position)
          join public.question_options as option on option.id = ordered.option_id
          where option.question_id = question.id
        ), '[]'::jsonb),
        'explanation', case
          when attempt.status <> 'IN_PROGRESS'
            and quiz.allow_result_review
            and quiz.show_explanations then question.explanation
          else null
        end
      ) order by item.position)
      from public.quiz_attempt_questions as item
      join public.quiz_questions as question on question.id = item.question_id
      join public.quiz_answers as answer
        on answer.attempt_id = item.attempt_id
       and answer.question_id = item.question_id
      where item.attempt_id = attempt.id
    ), '[]'::jsonb)
  )
  into result
  from public.quiz_attempts as attempt
  join public.quizzes as quiz on quiz.id = attempt.quiz_id
  where attempt.id = target_attempt_id
    and attempt.student_id = (select auth.uid());

  if result is null then
    raise insufficient_privilege using message = 'This assessment attempt is unavailable.';
  end if;
  return result;
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

revoke all on function public.save_quiz_answer(uuid, uuid, uuid[], text, boolean)
  from public, anon;
grant execute on function public.save_quiz_answer(uuid, uuid, uuid[], text, boolean)
  to authenticated;
revoke all on function public.submit_quiz_attempt(uuid) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;
revoke all on function public.get_student_quiz_attempt(uuid) from public, anon;
grant execute on function public.get_student_quiz_attempt(uuid) to authenticated;
