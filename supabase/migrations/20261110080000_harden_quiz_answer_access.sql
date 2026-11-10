revoke select on public.quiz_questions, public.question_options
  from public, anon, authenticated;

grant select (
  id,
  quiz_id,
  question_text,
  question_type,
  points,
  position,
  created_at,
  difficulty,
  resource_links
) on public.quiz_questions to authenticated;

grant select (id, question_id, option_text, position)
  on public.question_options to authenticated;

create or replace function public.prevent_assessment_mutation_after_attempts()
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
    if tg_table_name = 'quizzes' then
      if tg_op = 'UPDATE' and (
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
      end if;
    else
      raise check_violation using message = 'Assessment questions and options cannot change after attempts begin.';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.prevent_assessment_mutation_after_attempts()
  from public, anon, authenticated;
