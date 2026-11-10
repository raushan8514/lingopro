alter table public.quiz_questions
  add column difficulty text
    check (difficulty in ('EASY', 'MEDIUM', 'HARD')),
  add column resource_links jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(resource_links) = 'array'
      and jsonb_array_length(resource_links) <= 5
    ),
  add column bank_item_id uuid;

create table public.question_bank_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  source_question_id uuid references public.quiz_questions (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  question_text text not null check (
    char_length(btrim(question_text)) between 1 and 10000
  ),
  question_type text not null check (
    question_type in (
      'SINGLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE',
      'FILL_IN_THE_BLANK', 'SHORT_ANSWER', 'MATCHING'
    )
  ),
  difficulty text check (difficulty in ('EASY', 'MEDIUM', 'HARD')),
  resource_links jsonb not null default '[]'::jsonb check (
    jsonb_typeof(resource_links) = 'array'
    and jsonb_array_length(resource_links) <= 5
  ),
  points numeric(7, 2) not null check (points > 0),
  explanation text,
  grading_mode text not null check (grading_mode in ('AUTO', 'MANUAL')),
  answer_key text,
  accepted_answers text[] not null default '{}',
  case_sensitive boolean not null default false,
  normalize_whitespace boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, source_question_id)
);



create index question_bank_items_course_created_idx
  on public.question_bank_items (course_id, created_at desc);

create trigger question_bank_items_set_updated_at
before update on public.question_bank_items
for each row execute function public.set_updated_at();

create table public.question_bank_options (
  id uuid primary key default gen_random_uuid(),
  bank_item_id uuid not null references public.question_bank_items (id) on delete cascade,
  option_text text not null check (
    char_length(btrim(option_text)) between 1 and 4000
  ),
  position integer not null check (position >= 0),
  is_correct boolean not null default false,
  unique (bank_item_id, position)
);

create index question_bank_options_item_position_idx
  on public.question_bank_options (bank_item_id, position);

alter table public.question_bank_items enable row level security;
alter table public.question_bank_options enable row level security;
revoke all on public.question_bank_items, public.question_bank_options
  from public, anon, authenticated;
grant select on public.question_bank_items, public.question_bank_options
  to authenticated;

create policy "Course managers read their question bank"
on public.question_bank_items for select to authenticated
using ((select public.can_manage_course(course_id)));

create policy "Course managers read question bank options"
on public.question_bank_options for select to authenticated
using (
  exists (
    select 1
    from public.question_bank_items as item
    where item.id = question_bank_options.bank_item_id
      and (select public.can_manage_course(item.course_id))
  )
);

alter table public.quiz_questions
  add constraint quiz_questions_bank_item_fk
    foreign key (bank_item_id)
    references public.question_bank_items (id)
    on delete set null;

create unique index quiz_questions_bank_item_once_idx
  on public.quiz_questions (quiz_id, bank_item_id)
  where bank_item_id is not null;

create function public.enforce_quiz_question_count_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_count integer;
begin
  perform 1
  from public.quizzes as quiz
  where quiz.id = new.quiz_id
  for update;
  if not found then
    raise foreign_key_violation using message = 'The assessment does not exist.';
  end if;

  select count(*)::integer
  into question_count
  from public.quiz_questions as question
  where question.quiz_id = new.quiz_id;
  if question_count >= 100 then
    raise check_violation using message = 'An assessment can contain at most 100 questions.';
  end if;
  return new;
end;
$$;

create trigger quiz_questions_enforce_count_limit
before insert on public.quiz_questions
for each row execute function public.enforce_quiz_question_count_limit();

revoke all on function public.enforce_quiz_question_count_limit()
  from public, anon, authenticated;

create function public.enforce_question_bank_count_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bank_count integer;
begin
  perform 1
  from public.courses as course
  where course.id = new.course_id
  for update;
  if not found then
    raise foreign_key_violation using message = 'The course does not exist.';
  end if;

  if new.source_question_id is not null and exists (
    select 1
    from public.question_bank_items as item
    where item.course_id = new.course_id
      and item.source_question_id = new.source_question_id
  ) then
    return new;
  end if;

  select count(*)::integer
  into bank_count
  from public.question_bank_items as item
  where item.course_id = new.course_id;
  if bank_count >= 500 then
    raise check_violation using message = 'A course question bank can contain at most 500 questions.';
  end if;
  return new;
end;
$$;

create trigger question_bank_items_enforce_count_limit
before insert on public.question_bank_items
for each row execute function public.enforce_question_bank_count_limit();

revoke all on function public.enforce_question_bank_count_limit()
  from public, anon, authenticated;

create function public.save_instructor_quiz_question_with_metadata(
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
  resources jsonb := coalesce(p_resource_links, '[]'::jsonb);
begin
  if p_difficulty is not null
    and p_difficulty not in ('EASY', 'MEDIUM', 'HARD') then
    raise check_violation using message = 'Choose a valid question difficulty.';
  end if;
  if jsonb_typeof(resources) is distinct from 'array'
    or jsonb_array_length(resources) > 5
    or exists (
      select 1
      from jsonb_array_elements(resources) as item(value)
      where jsonb_typeof(item.value) is distinct from 'object'
        or jsonb_typeof(item.value -> 'label') is distinct from 'string'
        or jsonb_typeof(item.value -> 'url') is distinct from 'string'
        or char_length(btrim(item.value ->> 'label')) not between 1 and 120
        or char_length(item.value ->> 'url') > 2048
        or (item.value ->> 'url') !~ '^https://[^[:space:]]+$'
    ) then
    raise check_violation using message = 'Add up to five resources with a label and HTTPS URL.';
  end if;

  saved_question_id := public.save_instructor_quiz_question(
    target_course_id,
    target_quiz_id,
    target_question_id,
    p_question_text,
    p_question_type,
    p_points,
    p_manual_grading,
    p_accepted_answers,
    p_case_sensitive,
    p_normalize_whitespace,
    p_explanation,
    p_question_options
  );

  update public.quiz_questions
  set difficulty = p_difficulty,
    resource_links = resources
  where id = saved_question_id
    and quiz_id = target_quiz_id;

  return saved_question_id;
end;
$$;

revoke all on function public.save_instructor_quiz_question_with_metadata(
  uuid, uuid, uuid, text, text, numeric, boolean, text[], boolean,
  boolean, text, jsonb, text, jsonb
) from public, anon;
grant execute on function public.save_instructor_quiz_question_with_metadata(
  uuid, uuid, uuid, text, text, numeric, boolean, text[], boolean,
  boolean, text, jsonb, text, jsonb
) to authenticated;

create function public.save_quiz_question_to_bank(
  target_course_id uuid,
  target_quiz_id uuid,
  target_question_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  bank_item_id_value uuid;
begin
  if (select auth.uid()) is null
    or not (select public.can_manage_course(target_course_id))
    or not exists (
      select 1 from public.quizzes as quiz
      where quiz.id = target_quiz_id
        and quiz.course_id = target_course_id
    )
    or not exists (
      select 1 from public.quiz_questions as question
      where question.id = target_question_id
        and question.quiz_id = target_quiz_id
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  insert into public.question_bank_items (
    course_id, source_question_id, created_by, question_text, question_type,
    difficulty, resource_links, points, explanation, grading_mode, answer_key,
    accepted_answers, case_sensitive, normalize_whitespace
  )
  select
    target_course_id, question.id, (select auth.uid()), question.question_text,
    question.question_type, question.difficulty, question.resource_links,
    question.points, question.explanation, question.grading_mode,
    question.answer_key, question.accepted_answers, question.case_sensitive,
    question.normalize_whitespace
  from public.quiz_questions as question
  where question.id = target_question_id
  on conflict (course_id, source_question_id)
  do update set
    created_by = excluded.created_by,
    question_text = excluded.question_text,
    question_type = excluded.question_type,
    difficulty = excluded.difficulty,
    resource_links = excluded.resource_links,
    points = excluded.points,
    explanation = excluded.explanation,
    grading_mode = excluded.grading_mode,
    answer_key = excluded.answer_key,
    accepted_answers = excluded.accepted_answers,
    case_sensitive = excluded.case_sensitive,
    normalize_whitespace = excluded.normalize_whitespace
  returning id into bank_item_id_value;

  delete from public.question_bank_options
  where bank_item_id = bank_item_id_value;

  insert into public.question_bank_options (
    bank_item_id, option_text, position, is_correct
  )
  select bank_item_id_value, option.option_text, option.position, option.is_correct
  from public.question_options as option
  where option.question_id = target_question_id;

  return bank_item_id_value;
end;
$$;

create function public.import_question_bank_item(
  target_course_id uuid,
  target_quiz_id uuid,
  target_bank_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  bank_item record;
  question_id_value uuid;
  position_value integer;
begin
  if (select auth.uid()) is null
    or not (select public.can_manage_course(target_course_id)) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  select quiz.is_published
  into bank_item
  from public.quizzes as quiz
  where quiz.id = target_quiz_id
    and quiz.course_id = target_course_id
  for update;
  if not found then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;
  if bank_item.is_published or exists (
    select 1 from public.quiz_attempts as attempt
    where attempt.quiz_id = target_quiz_id
  ) then
    raise check_violation using message = 'Unpublish the assessment before importing questions, and do not change a quiz with attempts.';
  end if;

  select *
  into bank_item
  from public.question_bank_items as item
  where item.id = target_bank_item_id
    and item.course_id = target_course_id;
  if not found then
    raise no_data_found using message = 'The question bank item is unavailable.';
  end if;
  if exists (
    select 1
    from public.quiz_questions as question
    where question.quiz_id = target_quiz_id
      and question.bank_item_id = target_bank_item_id
  ) then
    raise unique_violation using message = 'This question is already in the assessment.';
  end if;

  select coalesce(max(question.position), -1) + 1
  into position_value
  from public.quiz_questions as question
  where question.quiz_id = target_quiz_id;

  insert into public.quiz_questions (
    quiz_id, question_text, question_type, explanation, points, position,
    grading_mode, answer_key, accepted_answers, case_sensitive,
    normalize_whitespace, difficulty, resource_links, bank_item_id
  )
  values (
    target_quiz_id,
    bank_item.question_text,
    bank_item.question_type,
    bank_item.explanation,
    bank_item.points,
    position_value,
    bank_item.grading_mode,
    bank_item.answer_key,
    bank_item.accepted_answers,
    bank_item.case_sensitive,
    bank_item.normalize_whitespace,
    bank_item.difficulty,
    bank_item.resource_links,
    target_bank_item_id
  )
  returning id into question_id_value;

  insert into public.question_options (
    question_id, option_text, position, is_correct
  )
  select question_id_value, option.option_text, option.position, option.is_correct
  from public.question_bank_options as option
  where option.bank_item_id = target_bank_item_id;

  return question_id_value;
end;
$$;

revoke all on function public.save_quiz_question_to_bank(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.save_quiz_question_to_bank(uuid, uuid, uuid)
  to authenticated;
revoke all on function public.import_question_bank_item(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.import_question_bank_item(uuid, uuid, uuid)
  to authenticated;

create table public.assessment_attempt_reviews (
  attempt_id uuid primary key references public.quiz_attempts (id) on delete restrict,
  review_status text not null check (review_status in ('FLAGGED', 'CLEARED')),
  review_note text not null check (char_length(btrim(review_note)) between 3 and 1000),
  reviewed_by uuid not null references public.profiles (id) on delete restrict,
  reviewed_at timestamptz not null default now()
);

create index assessment_attempt_reviews_status_idx
  on public.assessment_attempt_reviews (review_status, reviewed_at desc);

create table public.assessment_attempt_review_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete restrict,
  review_status text not null check (review_status in ('FLAGGED', 'CLEARED')),
  review_note text not null check (char_length(btrim(review_note)) between 3 and 1000),
  reviewed_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index assessment_attempt_review_events_attempt_idx
  on public.assessment_attempt_review_events (attempt_id, created_at desc);

alter table public.assessment_attempt_reviews enable row level security;
alter table public.assessment_attempt_review_events enable row level security;
revoke all on public.assessment_attempt_reviews,
  public.assessment_attempt_review_events from public, anon, authenticated;
grant select on public.assessment_attempt_reviews,
  public.assessment_attempt_review_events to authenticated;

create policy "Administrators read attempt review state"
on public.assessment_attempt_reviews for select to authenticated
using ((select public.current_user_is_admin()));

create policy "Administrators read attempt review history"
on public.assessment_attempt_review_events for select to authenticated
using ((select public.current_user_is_admin()));

create function public.admin_review_assessment_attempt(
  target_attempt_id uuid,
  requested_status text,
  review_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;
  if requested_status not in ('FLAGGED', 'CLEARED')
    or review_reason is null
    or char_length(btrim(review_reason)) not between 3 and 1000 then
    raise check_violation using message = 'Choose a review action and provide a 3–1,000 character reason.';
  end if;
  if not exists (
    select 1 from public.quiz_attempts as attempt
    where attempt.id = target_attempt_id
  ) then
    raise no_data_found using message = 'The assessment attempt does not exist.';
  end if;

  insert into public.assessment_attempt_reviews (
    attempt_id, review_status, review_note, reviewed_by, reviewed_at
  )
  values (
    target_attempt_id, requested_status, btrim(review_reason),
    (select auth.uid()), now()
  )
  on conflict (attempt_id) do update
  set review_status = excluded.review_status,
    review_note = excluded.review_note,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at;

  insert into public.assessment_attempt_review_events (
    attempt_id, review_status, review_note, reviewed_by
  )
  values (
    target_attempt_id, requested_status, btrim(review_reason), (select auth.uid())
  );
end;
$$;

create function public.admin_list_assessment_attempts(
  target_assessment_id uuid,
  page_limit integer default 100,
  page_offset integer default 0
)
returns table (
  attempt_id uuid,
  student_id uuid,
  student_name text,
  attempt_number integer,
  attempt_status text,
  score numeric,
  total_points numeric,
  started_at timestamptz,
  submitted_at timestamptz,
  is_expired boolean,
  review_status text,
  review_note text,
  reviewed_at timestamptz,
  reviewer_name text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;
  if page_limit is null or page_offset is null
    or page_limit not between 1 and 100 or page_offset < 0 then
    raise check_violation using message = 'Invalid assessment attempt page.';
  end if;
  if not exists (
    select 1 from public.quizzes as quiz where quiz.id = target_assessment_id
  ) then
    raise no_data_found using message = 'The selected assessment does not exist.';
  end if;

  return query
  select
    attempt.id,
    attempt.student_id,
    coalesce(profile.full_name, 'Learner'),
    attempt.attempt_number,
    attempt.status,
    attempt.score,
    attempt.total_points,
    attempt.started_at,
    attempt.submitted_at,
    attempt.is_expired,
    review.review_status,
    review.review_note,
    review.reviewed_at,
    reviewer.full_name,
    count(*) over ()
  from public.quiz_attempts as attempt
  join public.profiles as profile on profile.id = attempt.student_id
  left join public.assessment_attempt_reviews as review
    on review.attempt_id = attempt.id
  left join public.profiles as reviewer on reviewer.id = review.reviewed_by
  where attempt.quiz_id = target_assessment_id
  order by attempt.created_at desc, attempt.id
  limit page_limit offset page_offset;
end;
$$;

revoke all on function public.admin_review_assessment_attempt(uuid, text, text)
  from public, anon;
grant execute on function public.admin_review_assessment_attempt(uuid, text, text)
  to authenticated;
revoke all on function public.admin_list_assessment_attempts(uuid, integer, integer)
  from public, anon;
grant execute on function public.admin_list_assessment_attempts(uuid, integer, integer)
  to authenticated;

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
        'difficulty', question.difficulty,
        'resource_links', question.resource_links,
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

revoke all on function public.get_student_quiz_attempt(uuid) from public, anon;
grant execute on function public.get_student_quiz_attempt(uuid) to authenticated;
