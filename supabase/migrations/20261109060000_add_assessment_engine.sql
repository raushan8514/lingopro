alter table public.quizzes
  add column assessment_type text not null default 'PRACTICE'
    check (assessment_type in ('PRACTICE', 'EXAM')),
  add column available_from timestamptz,
  add column available_until timestamptz,
  add column randomize_questions boolean not null default false,
  add column randomize_options boolean not null default false,
  add column allow_partial_credit boolean not null default false,
  add column negative_marking numeric(7, 2) not null default 0
    check (negative_marking >= 0),
  add column allow_result_review boolean not null default true,
  add column show_correct_answers boolean not null default false,
  add column show_explanations boolean not null default false,
  add column allow_concurrent_attempts boolean not null default false,
  add constraint quizzes_availability_window_check
    check (available_from is null or available_until is null or available_until > available_from);

alter table public.quiz_questions
  add column accepted_answers text[] not null default '{}',
  add column case_sensitive boolean not null default false,
  add column normalize_whitespace boolean not null default true;

update public.quiz_questions
set accepted_answers = array[answer_key]
where question_type = 'FILL_IN_THE_BLANK'
  and grading_mode = 'AUTO'
  and answer_key is not null
  and cardinality(accepted_answers) = 0;

alter table public.quiz_questions
  drop constraint quiz_questions_question_type_check,
  add constraint quiz_questions_question_type_check check (
    question_type in (
      'SINGLE_CHOICE',
      'MULTIPLE_SELECT',
      'TRUE_FALSE',
      'FILL_IN_THE_BLANK',
      'SHORT_ANSWER'
    )
  ),
  drop constraint quiz_question_grading_mode_check,
  drop constraint quiz_question_answer_key_check,
  add constraint quiz_question_grading_mode_check check (
    (
      question_type in ('FILL_IN_THE_BLANK', 'SHORT_ANSWER')
      and grading_mode in ('AUTO', 'MANUAL')
    )
    or (
      question_type not in ('FILL_IN_THE_BLANK', 'SHORT_ANSWER')
      and grading_mode = 'AUTO'
    )
  ),
  add constraint quiz_question_answer_key_check check (
    question_type <> 'FILL_IN_THE_BLANK'
    or grading_mode = 'MANUAL'
    or cardinality(accepted_answers) > 0
    or nullif(btrim(answer_key), '') is not null
  ),
  add constraint quiz_question_short_answer_manual_check check (
    question_type <> 'SHORT_ANSWER' or grading_mode = 'MANUAL'
  );

alter table public.quiz_attempts
  add column expires_at timestamptz,
  add column is_expired boolean not null default false,
  drop constraint quiz_attempt_result_consistency_check,
  add constraint quiz_attempt_result_consistency_check check (
    (
      status = 'IN_PROGRESS'
      and score is null
      and submitted_at is null
      and not is_expired
    )
    or (
      status in ('PENDING_REVIEW', 'GRADED')
      and score is not null
      and score <= total_points
      and submitted_at is not null
    )
  );

alter table public.quiz_answers
  drop constraint quiz_answers_awarded_points_check;

create table public.quiz_attempt_questions (
  attempt_id uuid not null references public.quiz_attempts (id) on delete restrict,
  question_id uuid not null references public.quiz_questions (id) on delete restrict,
  position integer not null check (position >= 0),
  option_order uuid[] not null default '{}',
  is_flagged boolean not null default false,
  primary key (attempt_id, question_id),
  unique (attempt_id, position)
);

create index quiz_attempt_questions_attempt_position_idx
  on public.quiz_attempt_questions (attempt_id, position);

alter table public.quiz_attempt_questions enable row level security;

grant select on public.quiz_attempt_questions to authenticated;
revoke insert, update, delete on public.quiz_answers from authenticated;

create policy "Students and course managers read attempt question order"
on public.quiz_attempt_questions for select to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts as attempt
    join public.quizzes as quiz on quiz.id = attempt.quiz_id
    where attempt.id = quiz_attempt_questions.attempt_id
      and (
        attempt.student_id = (select auth.uid())
        or (select public.can_manage_course(quiz.course_id))
      )
  )
);

create or replace function public.validate_quiz_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_row record;
  option_count integer;
  correct_count integer;
begin
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    if new.available_from is not null and new.available_until is not null
      and new.available_until <= new.available_from then
      raise check_violation using message = 'The assessment availability window is invalid.';
    end if;

    if not exists (
      select 1 from public.quiz_questions as question
      where question.quiz_id = new.id
    ) then
      raise check_violation using message = 'An assessment needs at least one question before publishing.';
    end if;

    for question_row in
      select question.id, question.question_type, question.grading_mode,
        question.accepted_answers, question.answer_key
      from public.quiz_questions as question
      where question.quiz_id = new.id
    loop
      select count(*)::integer,
        count(*) filter (where option.is_correct)::integer
      into option_count, correct_count
      from public.question_options as option
      where option.question_id = question_row.id;

      if question_row.question_type in ('SINGLE_CHOICE', 'TRUE_FALSE')
        and (option_count < 2 or correct_count <> 1) then
        raise check_violation using message = 'Choice questions need valid options and exactly one correct answer.';
      elsif question_row.question_type = 'MULTIPLE_SELECT'
        and (option_count < 2 or correct_count < 1) then
        raise check_violation using message = 'Multiple-select questions need at least two options and one correct answer.';
      elsif question_row.question_type = 'TRUE_FALSE'
        and (option_count <> 2 or correct_count <> 1) then
        raise check_violation using message = 'True/false questions need exactly two options.';
      elsif question_row.question_type = 'FILL_IN_THE_BLANK'
        and question_row.grading_mode = 'AUTO'
        and cardinality(question_row.accepted_answers) = 0
        and nullif(btrim(question_row.answer_key), '') is null then
        raise check_violation using message = 'Automatically graded fill-in questions need an accepted answer.';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_quiz_publication() from public, anon, authenticated;

create trigger quizzes_validate_publication
before insert or update of is_published on public.quizzes
for each row execute function public.validate_quiz_publication();

create function public.prevent_assessment_mutation_after_attempts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quiz_id_value uuid;
begin
  if tg_table_name = 'quizzes' then
    quiz_id_value := coalesce(new.id, old.id);
  elsif tg_table_name = 'quiz_questions' then
    quiz_id_value := coalesce(new.quiz_id, old.quiz_id);
  else
    select question.quiz_id
    into quiz_id_value
    from public.quiz_questions as question
    where question.id = coalesce(new.question_id, old.question_id);
  end if;

  if exists (
    select 1
    from public.quiz_attempts as attempt
    where attempt.quiz_id = quiz_id_value
  ) then
    if tg_table_name = 'quizzes' and tg_op = 'UPDATE'
      and (
        old.course_id is distinct from new.course_id
        or old.lesson_id is distinct from new.lesson_id
        or old.assessment_type is distinct from new.assessment_type
        or old.time_limit_seconds is distinct from new.time_limit_seconds
        or old.passing_score is distinct from new.passing_score
        or old.maximum_attempts is distinct from new.maximum_attempts
        or old.available_from is distinct from new.available_from
        or old.available_until is distinct from new.available_until
        or old.randomize_questions is distinct from new.randomize_questions
        or old.randomize_options is distinct from new.randomize_options
        or old.allow_partial_credit is distinct from new.allow_partial_credit
        or old.negative_marking is distinct from new.negative_marking
        or old.allow_concurrent_attempts is distinct from new.allow_concurrent_attempts
        or old.allow_result_review is distinct from new.allow_result_review
        or old.show_correct_answers is distinct from new.show_correct_answers
        or old.show_explanations is distinct from new.show_explanations
      ) then
      raise check_violation using message = 'Assessment settings cannot change after attempts begin.';
    elsif tg_table_name <> 'quizzes' then
      raise check_violation using message = 'Assessment questions and options cannot change after attempts begin.';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.prevent_assessment_mutation_after_attempts() from public, anon, authenticated;

create trigger quizzes_prevent_attempt_mutation
before update on public.quizzes
for each row execute function public.prevent_assessment_mutation_after_attempts();

create trigger quiz_questions_prevent_attempt_mutation
before insert or update or delete on public.quiz_questions
for each row execute function public.prevent_assessment_mutation_after_attempts();

create trigger question_options_prevent_attempt_mutation
before insert or update or delete on public.question_options
for each row execute function public.prevent_assessment_mutation_after_attempts();

create or replace function public.start_quiz_attempt(target_quiz_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  quiz_row record;
  next_attempt_number integer;
  points_total numeric(9, 2);
  new_attempt_id uuid;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended((select auth.uid())::text || target_quiz_id::text, 0)
  );

  select quiz.id, quiz.course_id, quiz.is_published, quiz.maximum_attempts,
    quiz.time_limit_seconds, quiz.available_from, quiz.available_until,
    quiz.allow_concurrent_attempts, quiz.randomize_questions, quiz.randomize_options
  into quiz_row
  from public.quizzes as quiz
  where quiz.id = target_quiz_id
  for update;

  if not found or not quiz_row.is_published
    or not (select public.can_access_quiz(target_quiz_id)) then
    raise insufficient_privilege using message = 'This assessment is not available.';
  end if;

  if (quiz_row.available_from is not null and now() < quiz_row.available_from)
    or (quiz_row.available_until is not null and now() >= quiz_row.available_until) then
    raise check_violation using message = 'This assessment is outside its availability window.';
  end if;

  if not quiz_row.allow_concurrent_attempts and exists (
    select 1 from public.quiz_attempts as active_attempt
    where active_attempt.quiz_id = target_quiz_id
      and active_attempt.student_id = (select auth.uid())
      and active_attempt.status = 'IN_PROGRESS'
  ) then
    raise check_violation using message = 'Finish your active attempt before starting another.';
  end if;

  select count(*)::integer + 1
  into next_attempt_number
  from public.quiz_attempts as attempt
  where attempt.quiz_id = target_quiz_id
    and attempt.student_id = (select auth.uid());

  if quiz_row.maximum_attempts is not null
    and next_attempt_number > quiz_row.maximum_attempts then
    raise check_violation using message = 'The assessment attempt limit was reached.';
  end if;

  select coalesce(sum(question.points), 0)::numeric(9, 2)
  into points_total
  from public.quiz_questions as question
  where question.quiz_id = target_quiz_id;

  if points_total <= 0 then
    raise check_violation using message = 'The assessment has no gradable questions.';
  end if;

  insert into public.quiz_attempts (
    quiz_id, student_id, attempt_number, total_points, expires_at
  )
  values (
    target_quiz_id,
    (select auth.uid()),
    next_attempt_number,
    points_total,
    case
      when quiz_row.time_limit_seconds is null then null
      else now() + make_interval(secs => quiz_row.time_limit_seconds)
    end
  )
  returning id into new_attempt_id;

  insert into public.quiz_attempt_questions (
    attempt_id, question_id, position, option_order
  )
  select
    new_attempt_id,
    question.id,
    row_number() over (
      order by
        case when quiz_row.randomize_questions then random() end,
        question.position
    )::integer - 1,
    coalesce((
      select array_agg(option.id order by
        case when quiz_row.randomize_options then random() end,
        option.position
      )
      from public.question_options as option
      where option.question_id = question.id
    ), '{}'::uuid[])
  from public.quiz_questions as question
  where question.quiz_id = target_quiz_id;

  insert into public.quiz_answers (attempt_id, question_id)
  select new_attempt_id, item.question_id
  from public.quiz_attempt_questions as item
  where item.attempt_id = new_attempt_id;

  return new_attempt_id;
end;
$$;

create function public.save_quiz_answer(
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
  question_type_value text;
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

  select question.question_type
  into question_type_value
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
        question_type_value not in ('SINGLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE')
        or cardinality(target_option_ids) <> (
          select count(distinct supplied.option_id)
          from unnest(target_option_ids) as supplied(option_id)
        )
      )
    )
    or (
      question_type_value in ('SINGLE_CHOICE', 'TRUE_FALSE')
      and cardinality(target_option_ids) > 1
    )
    or (
      question_type_value in ('FILL_IN_THE_BLANK', 'SHORT_ANSWER')
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
  if question_type_value in ('SINGLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE')
    and nullif(target_answer_text, '') is not null then
    raise check_violation using message = 'This question accepts option selections only.';
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
      end if;

    if answer_is_correct then
      awarded_value := answer_row.points;
    elsif answer_is_present then
      if answer_row.question_type = 'MULTIPLE_SELECT'
        and attempt_row.allow_partial_credit then
        awarded_value := awarded_value - attempt_row.negative_marking;
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

create function public.get_student_quiz_attempt(target_attempt_id uuid)
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
        'points', question.points,
        'position', item.position,
        'is_flagged', item.is_flagged,
        'selected_option_ids', answer.selected_option_ids,
        'answer_text', answer.answer_text,
        'awarded_points', case when attempt.status = 'IN_PROGRESS' then null else answer.awarded_points end,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', option.id,
            'option_text', option.option_text,
            'is_correct', case
              when attempt.status <> 'IN_PROGRESS'
                and quiz.allow_result_review
                and quiz.show_correct_answers then option.is_correct
              else null
            end
          ) order by ordered.option_position)
          from unnest(item.option_order) with ordinality as ordered(option_id, option_position)
          join public.question_options as option on option.id = ordered.option_id
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

revoke all on function public.start_quiz_attempt(uuid) from public, anon;
revoke all on function public.save_quiz_answer(uuid, uuid, uuid[], text, boolean) from public, anon;
revoke all on function public.submit_quiz_attempt(uuid) from public, anon;
revoke all on function public.get_student_quiz_attempt(uuid) from public, anon;

grant execute on function public.start_quiz_attempt(uuid) to authenticated;
grant execute on function public.save_quiz_answer(uuid, uuid, uuid[], text, boolean) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;
grant execute on function public.get_student_quiz_attempt(uuid) to authenticated;
