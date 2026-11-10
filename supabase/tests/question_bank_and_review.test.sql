begin;

select plan(21);

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
    '00000000-0000-4000-8000-000000095001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'question-bank-student@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Question Bank Student"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000095002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'question-bank-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Question Bank Instructor"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000095003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'question-bank-admin@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Question Bank Admin"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000095002';
update public.profiles
set role = 'admin'
where id = '00000000-0000-4000-8000-000000095003';

insert into public.course_categories (id, name, slug, is_active)
values (
  '00000000-0000-4000-8000-000000095101',
  'Question Bank Tests',
  'question-bank-tests',
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
  '00000000-0000-4000-8000-000000095201',
  '00000000-0000-4000-8000-000000095002',
  '00000000-0000-4000-8000-000000095101',
  'Question Bank Course',
  'question-bank-course',
  'French',
  'BEGINNER',
  'DRAFT',
  null
);

insert into public.course_sections (id, course_id, title, position)
values (
  '00000000-0000-4000-8000-000000095251',
  '00000000-0000-4000-8000-000000095201',
  'Question bank unit',
  0
);

insert into public.lessons (
  id, section_id, title, description, content_type, position, is_published
)
values (
  '00000000-0000-4000-8000-000000095252',
  '00000000-0000-4000-8000-000000095251',
  'French practice',
  'Review the sample French phrases.',
  'TEXT',
  0,
  true
);

update public.courses
set status = 'PUBLISHED', published_at = now()
where id = '00000000-0000-4000-8000-000000095201';

insert into public.enrollments (
  id,
  student_id,
  course_id,
  status,
  enrollment_type
)
values (
  '00000000-0000-4000-8000-000000095301',
  '00000000-0000-4000-8000-000000095001',
  '00000000-0000-4000-8000-000000095201',
  'ACTIVE',
  'FREE'
);

insert into public.quizzes (id, course_id, title, is_published)
values
  (
    '00000000-0000-4000-8000-000000095401',
    '00000000-0000-4000-8000-000000095201',
    'Source assessment',
    false
  ),
  (
    '00000000-0000-4000-8000-000000095402',
    '00000000-0000-4000-8000-000000095201',
    'Imported assessment',
    false
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000095002","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000095002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select public.save_instructor_quiz_question_with_metadata(
      '00000000-0000-4000-8000-000000095201',
      '00000000-0000-4000-8000-000000095401',
      null,
      'Choose the correct French phrase.',
      'SINGLE_CHOICE',
      2,
      false,
      '{}',
      false,
      true,
      null,
      '[{"option_text":"Bonjour","is_correct":true},{"option_text":"Merci","is_correct":false}]'::jsonb,
      'HARD',
      '[{"label":"Reference","url":"http://example.test"}]'::jsonb
    )
  $$,
  '23514',
  null,
  'Question resources must use HTTPS'
);
select lives_ok(
  $$
    select public.save_instructor_quiz_question_with_metadata(
      '00000000-0000-4000-8000-000000095201',
      '00000000-0000-4000-8000-000000095401',
      null,
      'Choose the correct French phrase.',
      'SINGLE_CHOICE',
      2,
      false,
      '{}',
      false,
      true,
      null,
      '[{"option_text":"Bonjour","is_correct":true},{"option_text":"Merci","is_correct":false}]'::jsonb,
      'HARD',
      '[{"label":"Reference","url":"https://example.test/lesson"}]'::jsonb
    )
  $$,
  'An instructor can save a question with difficulty and HTTPS resources'
);
select is(
  (
    select difficulty
    from public.quiz_questions
    where quiz_id = '00000000-0000-4000-8000-000000095401'
  ),
  'HARD',
  'Question difficulty metadata is saved'
);
select set_config(
  'test.bank_item_id',
  public.save_quiz_question_to_bank(
    '00000000-0000-4000-8000-000000095201',
    '00000000-0000-4000-8000-000000095401',
    (
      select id
      from public.quiz_questions
      where quiz_id = '00000000-0000-4000-8000-000000095401'
    )
  )::text,
  true
);
select is(
  (
    select count(*)::integer
    from public.question_bank_items
    where course_id = '00000000-0000-4000-8000-000000095201'
  ),
  1,
  'The source question is saved in its course-scoped bank'
);
select lives_ok(
  format(
    'select public.import_question_bank_item(%L, %L, %L)',
    '00000000-0000-4000-8000-000000095201',
    '00000000-0000-4000-8000-000000095402',
    current_setting('test.bank_item_id')
  ),
  'A course bank question can be copied into another draft assessment'
);
select is(
  (
    select difficulty
    from public.quiz_questions
    where quiz_id = '00000000-0000-4000-8000-000000095402'
  ),
  'HARD',
  'Question difficulty is copied with the bank item'
);
select is(
  (
    select cardinality(answer_key.correct_option_ids)::integer
    from public.get_quiz_answer_key('00000000-0000-4000-8000-000000095402')
      as answer_key
    where answer_key.question_id = (
      select id
      from public.quiz_questions
      where quiz_id = '00000000-0000-4000-8000-000000095402'
    )
  ),
  1,
  'Correct-option data is copied with the question bank item'
);
select throws_ok(
  format(
    'select public.import_question_bank_item(%L, %L, %L)',
    '00000000-0000-4000-8000-000000095201',
    '00000000-0000-4000-8000-000000095402',
    current_setting('test.bank_item_id')
  ),
  '23505',
  null,
  'The same bank question cannot be imported twice into one assessment'
);

update public.quizzes
set is_published = true
where id = '00000000-0000-4000-8000-000000095402';
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000095001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000095001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'test.assessment_attempt_id',
  public.start_quiz_attempt('00000000-0000-4000-8000-000000095402')::text,
  true
);
select is(
  public.get_student_quiz_attempt(
    current_setting('test.assessment_attempt_id')::uuid
  ) #>> '{questions,0,difficulty}',
  'HARD',
  'Question difficulty is included in the learner attempt'
);
select is(
  jsonb_array_length(
    public.get_student_quiz_attempt(
      current_setting('test.assessment_attempt_id')::uuid
    ) #> '{questions,0,resource_links}'
  ),
  1,
  'Question resources are included in the learner attempt'
);
select is(
  (
    select count(*)::integer
    from public.question_bank_items
  ),
  0,
  'Learners cannot read instructor question banks'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000095003","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000095003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (
    select count(*)::integer
    from public.admin_list_assessment_attempts(
      '00000000-0000-4000-8000-000000095402',
      10,
      0
    )
  ),
  1,
  'Administrators can list assessment attempts without receiving response data'
);
select is(
  (
    select review_status
    from public.admin_list_assessment_attempts(
      '00000000-0000-4000-8000-000000095402',
      10,
      0
    )
  ),
  null,
  'Attempts start without an automated suspicion label'
);
select lives_ok(
  format(
    'select public.admin_review_assessment_attempt(%L, %L, %L)',
    current_setting('test.assessment_attempt_id'),
    'FLAGGED',
    'Needs a human review of the submitted work.'
  ),
  'An administrator can manually flag an attempt with a retained reason'
);
select is(
  (
    select review_status
    from public.assessment_attempt_reviews
    where attempt_id = current_setting('test.assessment_attempt_id')::uuid
  ),
  'FLAGGED',
  'The current manual review state is recorded'
);
select is(
  (
    select count(*)::integer
    from public.assessment_attempt_review_events
    where attempt_id = current_setting('test.assessment_attempt_id')::uuid
  ),
  1,
  'Manual review decisions are retained in append-only history'
);
select lives_ok(
  format(
    'select public.admin_review_assessment_attempt(%L, %L, %L)',
    current_setting('test.assessment_attempt_id'),
    'CLEARED',
    'Review found no policy concern.'
  ),
  'An administrator can clear a prior review flag'
);
select is(
  (
    select review_status
    from public.assessment_attempt_reviews
    where attempt_id = current_setting('test.assessment_attempt_id')::uuid
  ),
  'CLEARED',
  'Clearing a flag updates the current state without deleting history'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000095001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000095001', true);
select throws_ok(
  format(
    'select public.admin_review_assessment_attempt(%L, %L, %L)',
    current_setting('test.assessment_attempt_id'),
    'FLAGGED',
    'Learner must not flag an attempt.'
  ),
  '42501',
  null,
  'Learners cannot create administrator review flags'
);
select is(
  (
    select count(*)::integer
    from public.assessment_attempt_reviews
  ),
  0,
  'Learners cannot read administrator review notes'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.assessment_attempt_reviews',
    'INSERT'
  ),
  'Authenticated users cannot write review state directly'
);

select * from finish();
rollback;
