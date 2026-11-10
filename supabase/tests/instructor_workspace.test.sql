begin;

select plan(19);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000801',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'instructor-owner@example.test',
    crypt('temporary-test-password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Workspace Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000802',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'instructor-other@example.test',
    crypt('temporary-test-password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Other Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000803',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'instructor-learner@example.test',
    crypt('temporary-test-password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Workspace Learner"}',
    now(), now()
  );

update public.profiles
set role = 'instructor'
where id in (
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000802'
);

insert into public.courses (
  id, instructor_id, title, slug, language, difficulty, status
)
values
  (
    '00000000-0000-4000-8000-000000000811',
    '00000000-0000-4000-8000-000000000801',
    'Owner Course', 'owner-course', 'French', 'BEGINNER', 'DRAFT'
  ),
  (
    '00000000-0000-4000-8000-000000000812',
    '00000000-0000-4000-8000-000000000802',
    'Other Course', 'other-course', 'Spanish', 'BEGINNER', 'DRAFT'
  );

insert into public.course_sections (id, course_id, title, position)
values
  (
    '00000000-0000-4000-8000-000000000821',
    '00000000-0000-4000-8000-000000000811',
    'First section', 0
  ),
  (
    '00000000-0000-4000-8000-000000000822',
    '00000000-0000-4000-8000-000000000811',
    'Second section', 1
  );

insert into public.quizzes (id, course_id, title)
values
  (
    '00000000-0000-4000-8000-000000000831',
    '00000000-0000-4000-8000-000000000811',
    'Owner assessment'
  ),
  (
    '00000000-0000-4000-8000-000000000832',
    '00000000-0000-4000-8000-000000000812',
    'Other assessment'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$insert into public.courses (
    instructor_id, title, slug, language, difficulty, status
  ) values (
    '00000000-0000-4000-8000-000000000801',
    'Directly created draft',
    'directly-created-draft',
    'French',
    'BEGINNER',
    'DRAFT'
  )$$,
  'An authenticated instructor can create an owned draft through courses RLS'
);
select is(
  (
    select count(*)::integer
    from public.courses
    where slug = 'directly-created-draft'
      and instructor_id = '00000000-0000-4000-8000-000000000801'
  ),
  1,
  'The instructor can retrieve the draft after insertion'
);
select throws_ok(
  $$insert into public.courses (
    instructor_id, title, slug, language, difficulty, status
  ) values (
    '00000000-0000-4000-8000-000000000802',
    'Other instructor draft',
    'other-instructor-draft',
    'Spanish',
    'BEGINNER',
    'DRAFT'
  )$$,
  '42501',
  null,
  'An instructor cannot create a draft owned by another account'
);

select lives_ok(
  $$insert into public.lessons (
    section_id, title, content_type, content, position, is_published
  ) values (
    '00000000-0000-4000-8000-000000000821',
    'Instructor lesson',
    'TEXT',
    '{"blocks":[{"type":"paragraph","text":"Hola."}]}'::jsonb,
    0,
    true
  )$$,
  'An instructor can create a lesson in an owned section without recursive RLS'
);
select is(
  (
    select count(*)::integer
    from public.lessons
    where section_id = '00000000-0000-4000-8000-000000000821'
      and title = 'Instructor lesson'
  ),
  1,
  'The instructor can retrieve the lesson after insertion'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000802","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000802', true);
select throws_ok(
  $$insert into public.lessons (
    section_id, title, content_type, content, position, is_published
  ) values (
    '00000000-0000-4000-8000-000000000821',
    'Other instructor lesson',
    'TEXT',
    '{"blocks":[{"type":"paragraph","text":"Hola."}]}'::jsonb,
    1,
    true
  )$$,
  '42501',
  null,
  'Another instructor cannot create a lesson in a section they do not manage'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);

select lives_ok(
  $$select public.reorder_course_sections(
    '00000000-0000-4000-8000-000000000811',
    array[
      '00000000-0000-4000-8000-000000000822'::uuid,
      '00000000-0000-4000-8000-000000000821'::uuid
    ]
  )$$,
  'An instructor can reorder all sections in an owned course'
);
select is(
  (
    select id from public.course_sections
    where course_id = '00000000-0000-4000-8000-000000000811'
      and position = 0
  ),
  '00000000-0000-4000-8000-000000000822'::uuid,
  'The requested section order is persisted'
);
select throws_ok(
  $$select public.reorder_course_sections(
    '00000000-0000-4000-8000-000000000811',
    array[
      '00000000-0000-4000-8000-000000000821'::uuid,
      '00000000-0000-4000-8000-000000000821'::uuid
    ]
  )$$,
  '23514',
  null,
  'Duplicate section IDs are rejected'
);
select throws_ok(
  $$select public.reorder_course_sections(
    '00000000-0000-4000-8000-000000000812',
    '{}'::uuid[]
  )$$,
  '42501',
  null,
  'An instructor cannot reorder another instructor course'
);

select lives_ok(
  $$select public.save_instructor_quiz_question(
    '00000000-0000-4000-8000-000000000811',
    '00000000-0000-4000-8000-000000000831',
    null,
    'Choose the greeting',
    'SINGLE_CHOICE',
    1,
    false,
    '{}'::text[],
    false,
    true,
    null,
    '[{"option_text":"Bonjour","is_correct":true},{"option_text":"Hola","is_correct":false}]'::jsonb
  )$$,
  'An instructor can create a valid assessment question'
);
select is(
  (
    select count(*)::integer
    from public.question_options as option
    join public.quiz_questions as question on question.id = option.question_id
    where question.quiz_id = '00000000-0000-4000-8000-000000000831'
  ),
  2,
  'Question creation stores every option'
);
select lives_ok(
  $$select public.save_instructor_quiz_question(
    '00000000-0000-4000-8000-000000000811',
    '00000000-0000-4000-8000-000000000831',
    (
      select id from public.quiz_questions
      where quiz_id = '00000000-0000-4000-8000-000000000831'
    ),
    'Choose the greeting in English',
    'SINGLE_CHOICE',
    2,
    false,
    '{}'::text[],
    false,
    true,
    'Select the English greeting.',
    '[{"option_text":"Hello","is_correct":true},{"option_text":"Goodbye","is_correct":false},{"option_text":"Welcome","is_correct":false}]'::jsonb
  )$$,
  'Question edits atomically replace all option rows'
);
select is(
  (
    select count(*)::integer
    from public.question_options as option
    join public.quiz_questions as question on question.id = option.question_id
    where question.quiz_id = '00000000-0000-4000-8000-000000000831'
  ),
  3,
  'Edited options contain no stale rows'
);
select lives_ok(
  $$update public.quizzes
    set is_published = true
    where id = '00000000-0000-4000-8000-000000000831'$$,
  'A complete assessment can be published'
);
select throws_ok(
  $$select public.save_instructor_quiz_question(
    '00000000-0000-4000-8000-000000000811',
    '00000000-0000-4000-8000-000000000831',
    (
      select id from public.quiz_questions
      where quiz_id = '00000000-0000-4000-8000-000000000831'
    ),
    'Changed after publication',
    'SINGLE_CHOICE',
    2,
    false,
    '{}'::text[],
    false,
    true,
    null,
    '[{"option_text":"Yes","is_correct":true},{"option_text":"No","is_correct":false}]'::jsonb
  )$$,
  '23514',
  null,
  'Published assessment questions require unpublishing before edits'
);
select is(
  (
    select accepted_answers
    from public.get_quiz_answer_key('00000000-0000-4000-8000-000000000831')
    limit 1
  ),
  '{}'::text[],
  'The instructor answer-key RPC includes accepted answer metadata'
);
select lives_ok(
  $$update public.quizzes
    set is_published = false
    where id = '00000000-0000-4000-8000-000000000831'$$,
  'An instructor can unpublish an assessment'
);

reset role;
update public.quizzes
set is_published = true
where id = '00000000-0000-4000-8000-000000000831';

insert into public.quiz_attempts (
  quiz_id, student_id, attempt_number, total_points
)
values (
  '00000000-0000-4000-8000-000000000831',
  '00000000-0000-4000-8000-000000000803',
  1,
  2
);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.save_instructor_quiz_question(
    '00000000-0000-4000-8000-000000000811',
    '00000000-0000-4000-8000-000000000831',
    (
      select id from public.quiz_questions
      where quiz_id = '00000000-0000-4000-8000-000000000831'
    ),
    'Changed after attempt',
    'SINGLE_CHOICE',
    2,
    false,
    '{}'::text[],
    false,
    true,
    null,
    '[{"option_text":"Yes","is_correct":true},{"option_text":"No","is_correct":false}]'::jsonb
  )$$,
  '23514',
  null,
  'Question and option edits are rejected after any attempt starts'
);

select * from finish();
rollback;
