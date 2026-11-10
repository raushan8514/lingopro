begin;

select plan(9);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000093001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'matching-student@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Matching Student"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000093002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'matching-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Matching Instructor"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000093003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'matching-outsider@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Matching Outsider"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000093002';

insert into public.course_categories (id, name, slug, is_active)
values (
  '00000000-0000-4000-8000-000000093101',
  'Matching Assessment Tests',
  'matching-assessment-tests',
  true
);

insert into public.courses (
  id,
  instructor_id,
  category_id,
  title,
  slug,
  language,
  difficulty,
  status,
  published_at
)
values (
  '00000000-0000-4000-8000-000000093201',
  '00000000-0000-4000-8000-000000093002',
  '00000000-0000-4000-8000-000000093101',
  'Matching Assessment Course',
  'matching-assessment-course',
  'Spanish',
  'BEGINNER',
  'DRAFT',
  null
);

insert into public.course_sections (id, course_id, title, position)
values (
  '00000000-0000-4000-8000-000000093251',
  '00000000-0000-4000-8000-000000093201',
  'Matching module',
  0
);

insert into public.lessons (
  id, section_id, title, description, content_type, position, is_published
)
values (
  '00000000-0000-4000-8000-000000093252',
  '00000000-0000-4000-8000-000000093251',
  'Spanish greetings',
  'Review the basic greetings.',
  'TEXT',
  0,
  true
);

update public.courses
set status = 'PUBLISHED', published_at = now()
where id = '00000000-0000-4000-8000-000000093201';

insert into public.enrollments (
  id,
  student_id,
  course_id,
  status,
  enrollment_type
)
values (
  '00000000-0000-4000-8000-000000093301',
  '00000000-0000-4000-8000-000000093001',
  '00000000-0000-4000-8000-000000093201',
  'ACTIVE',
  'FREE'
);

insert into public.quizzes (
  id,
  course_id,
  title,
  passing_score,
  allow_partial_credit,
  allow_result_review,
  show_correct_answers,
  is_published
)
values (
  '00000000-0000-4000-8000-000000093401',
  '00000000-0000-4000-8000-000000093201',
  'Match the phrases',
  70,
  true,
  true,
  true,
  false
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000093002","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000093002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.save_instructor_quiz_question(
      '00000000-0000-4000-8000-000000093201',
      '00000000-0000-4000-8000-000000093401',
      null,
      'Match each Spanish phrase to its English meaning.',
      'MATCHING',
      10,
      false,
      array['hello', 'goodbye'],
      false,
      true,
      null,
      '[{"option_text":"hola","is_correct":false},{"option_text":"adios","is_correct":false}]'::jsonb
    )
  $$,
  'An instructor can save a matching question with aligned prompt-answer pairs'
);
select is(
  (
    select question_type
    from public.quiz_questions
    where quiz_id = '00000000-0000-4000-8000-000000093401'
  ),
  'MATCHING',
  'The assessment stores the matching question type'
);

reset role;
update public.quizzes
set is_published = true
where id = '00000000-0000-4000-8000-000000093401';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000093001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000093001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select set_config(
  'test.matching_attempt_one',
  public.start_quiz_attempt('00000000-0000-4000-8000-000000093401')::text,
  true
);
select is(
  jsonb_array_length(
    public.get_student_quiz_attempt(
      current_setting('test.matching_attempt_one')::uuid
    ) #> '{questions,0,matching_choices}'
  ),
  2,
  'A matching attempt receives the answer choices without pair mappings'
);
select is(
  public.get_student_quiz_attempt(
    current_setting('test.matching_attempt_one')::uuid
  ) #>> '{questions,0,options,0,matching_answer}',
  null,
  'Correct pairings are not exposed while an attempt is in progress'
);

select set_config(
  'test.matching_duplicate_response',
  (
    select jsonb_object_agg(option.id::text, 'hello')::text
    from public.question_options as option
    where option.question_id = (
      select question.id
      from public.quiz_questions as question
      where question.quiz_id = '00000000-0000-4000-8000-000000093401'
    )
  ),
  true
);
select throws_ok(
  format(
    'select public.save_quiz_answer(%L, %L, %L::uuid[], %L, false)',
    current_setting('test.matching_attempt_one'),
    (
      select question.id
      from public.quiz_questions as question
      where question.quiz_id = '00000000-0000-4000-8000-000000093401'
    ),
    '{}',
    current_setting('test.matching_duplicate_response')
  ),
  '23514',
  null,
  'A learner cannot assign the same matching answer more than once'
);

select set_config(
  'test.matching_correct_response',
  (
    select jsonb_object_agg(
      option.id::text,
      case option.position when 0 then 'hello' else 'goodbye' end
    )::text
    from public.question_options as option
    where option.question_id = (
      select question.id
      from public.quiz_questions as question
      where question.quiz_id = '00000000-0000-4000-8000-000000093401'
    )
  ),
  true
);
select public.save_quiz_answer(
  current_setting('test.matching_attempt_one')::uuid,
  (
    select question.id
    from public.quiz_questions as question
    where question.quiz_id = '00000000-0000-4000-8000-000000093401'
  ),
  '{}'::uuid[],
  current_setting('test.matching_correct_response'),
  false
);
select is(
  (
    select awarded_score
    from public.submit_quiz_attempt(
      current_setting('test.matching_attempt_one')::uuid
    )
  ),
  10::numeric,
  'The database awards full points for all correctly matched pairs'
);
select is(
  public.get_student_quiz_attempt(
    current_setting('test.matching_attempt_one')::uuid
  ) #>> '{questions,0,options,0,matching_answer}',
  'hello',
  'Correct matches are disclosed after submission when result review permits it'
);

select set_config(
  'test.matching_attempt_two',
  public.start_quiz_attempt('00000000-0000-4000-8000-000000093401')::text,
  true
);
select public.save_quiz_answer(
  current_setting('test.matching_attempt_two')::uuid,
  (
    select question.id
    from public.quiz_questions as question
    where question.quiz_id = '00000000-0000-4000-8000-000000093401'
  ),
  '{}'::uuid[],
  (
    select jsonb_build_object(option.id::text, 'hello')::text
    from public.question_options as option
    where option.question_id = (
      select question.id
      from public.quiz_questions as question
      where question.quiz_id = '00000000-0000-4000-8000-000000093401'
    )
      and option.position = 0
  ),
  false
);
select is(
  (
    select awarded_score
    from public.submit_quiz_attempt(
      current_setting('test.matching_attempt_two')::uuid
    )
  ),
  5::numeric,
  'Partial-credit matching awards points per correctly matched pair'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000093003","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000093003', true);
select throws_ok(
  format(
    'select public.get_student_quiz_attempt(%L::uuid)',
    current_setting('test.matching_attempt_one')
  ),
  '42501',
  null,
  'Another learner cannot inspect a student assessment attempt'
);

select * from finish();
rollback;
