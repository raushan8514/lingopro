begin;

select plan(8);

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
    '00000000-0000-4000-8000-000000094001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'assessment-authoring-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Assessment Authoring Instructor"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000094002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'assessment-authoring-outsider@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Assessment Authoring Outsider"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id in (
  '00000000-0000-4000-8000-000000094001',
  '00000000-0000-4000-8000-000000094002'
);

insert into public.course_categories (id, name, slug, is_active)
values (
  '00000000-0000-4000-8000-000000094101',
  'Assessment Authoring Tests',
  'assessment-authoring-tests',
  true
);

insert into public.courses (
  id, instructor_id, category_id, title, slug, language, difficulty, status
)
values (
  '00000000-0000-4000-8000-000000094201',
  '00000000-0000-4000-8000-000000094001',
  '00000000-0000-4000-8000-000000094101',
  'Assessment Authoring Test Course',
  'assessment-authoring-test-course',
  'Spanish',
  'BEGINNER',
  'DRAFT'
);

insert into public.quizzes (id, course_id, title)
values (
  '00000000-0000-4000-8000-000000094401',
  '00000000-0000-4000-8000-000000094201',
  'Assessment Authoring Test'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000094001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000094001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.save_instructor_quiz_question_for_editor(
      '00000000-0000-4000-8000-000000094201',
      '00000000-0000-4000-8000-000000094401',
      null,
      'Describe how you would introduce yourself in Spanish.',
      'LONG_ANSWER',
      10,
      true,
      '{}'::text[],
      false,
      true,
      null,
      '[]'::jsonb,
      null,
      '[]'::jsonb
    )
  $$,
  'An instructor can save a manually graded long-answer question'
);

select is(
  (
    select question_type
    from public.quiz_questions
    where quiz_id = '00000000-0000-4000-8000-000000094401'
      and question_text like 'Describe how%'
  ),
  'LONG_ANSWER',
  'The long-answer question type persists distinctly'
);

select is(
  (
    select grading_mode
    from public.quiz_questions
    where quiz_id = '00000000-0000-4000-8000-000000094401'
      and question_type = 'LONG_ANSWER'
  ),
  'MANUAL',
  'Long-answer questions are always marked for manual grading'
);

select lives_ok(
  $$
    select public.save_instructor_quiz_question_for_editor(
      '00000000-0000-4000-8000-000000094201',
      '00000000-0000-4000-8000-000000094401',
      null,
      'Write one short greeting in Spanish.',
      'SHORT_ANSWER',
      2,
      true,
      '{}'::text[],
      false,
      true,
      null,
      '[]'::jsonb,
      null,
      '[]'::jsonb
    )
  $$,
  'An instructor can add a second question to the draft'
);

select lives_ok(
  $$
    select public.reorder_instructor_quiz_questions(
      '00000000-0000-4000-8000-000000094201',
      '00000000-0000-4000-8000-000000094401',
      array[
        (
          select id
          from public.quiz_questions
          where quiz_id = '00000000-0000-4000-8000-000000094401'
            and question_type = 'SHORT_ANSWER'
        ),
        (
          select id
          from public.quiz_questions
          where quiz_id = '00000000-0000-4000-8000-000000094401'
            and question_type = 'LONG_ANSWER'
        )
      ]
    )
  $$,
  'The instructor can reorder all draft questions atomically'
);

select is(
  (
    select position
    from public.quiz_questions
    where quiz_id = '00000000-0000-4000-8000-000000094401'
      and question_type = 'LONG_ANSWER'
  ),
  1,
  'Reordering updates the long-answer position'
);

select is(
  (
    select position
    from public.quiz_questions
    where quiz_id = '00000000-0000-4000-8000-000000094401'
      and question_type = 'SHORT_ANSWER'
  ),
  0,
  'Reordering updates the short-answer position'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000094002","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000094002',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  format(
    'select public.reorder_instructor_quiz_questions(%L, %L, %L::uuid[])',
    '00000000-0000-4000-8000-000000094201',
    '00000000-0000-4000-8000-000000094401',
    (
      select array_agg(id order by position)::text
      from public.quiz_questions
      where quiz_id = '00000000-0000-4000-8000-000000094401'
    )
  ),
  '42501',
  'Course manager access is required.',
  'An instructor cannot reorder another instructor assessment'
);

select * from finish();
rollback;
