begin;

select plan(22);

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
    'certification-student@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Certification Student"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000094002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'certification-outsider@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Certification Outsider"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000094003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'certification-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Certification Instructor"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000094003';

insert into public.course_categories (id, name, slug, is_active)
values (
  '00000000-0000-4000-8000-000000094101',
  'Certification Tests',
  'certification-tests',
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
  '00000000-0000-4000-8000-000000094201',
  '00000000-0000-4000-8000-000000094003',
  '00000000-0000-4000-8000-000000094101',
  'Certification Requirements Course',
  'certification-requirements-course',
  'Spanish',
  'BEGINNER',
  'DRAFT',
  null
);

insert into public.course_sections (id, course_id, title, position)
values (
  '00000000-0000-4000-8000-000000094301',
  '00000000-0000-4000-8000-000000094201',
  'Module One',
  0
);

insert into public.lessons (
  id,
  section_id,
  title,
  description,
  content_type,
  position,
  is_published
)
values
  (
    '00000000-0000-4000-8000-000000094401',
    '00000000-0000-4000-8000-000000094301',
    'Lesson One',
    'Read the first lesson.',
    'TEXT',
    0,
    true
  ),
  (
    '00000000-0000-4000-8000-000000094402',
    '00000000-0000-4000-8000-000000094301',
    'Lesson Two',
    'Read the second lesson.',
    'TEXT',
    1,
    true
  );

update public.courses
set status = 'PUBLISHED', published_at = now()
where id = '00000000-0000-4000-8000-000000094201';

insert into public.enrollments (
  id,
  student_id,
  course_id,
  status,
  enrollment_type
)
values
  (
    '00000000-0000-4000-8000-000000094501',
    '00000000-0000-4000-8000-000000094001',
    '00000000-0000-4000-8000-000000094201',
    'ACTIVE',
    'FREE'
  ),
  (
    '00000000-0000-4000-8000-000000094502',
    '00000000-0000-4000-8000-000000094002',
    '00000000-0000-4000-8000-000000094201',
    'ACTIVE',
    'FREE'
  );

insert into public.course_certificate_requirements (
  course_id,
  required_lesson_completion_percent,
  require_required_assessments,
  require_final_exam,
  minimum_final_exam_score,
  updated_by
)
values (
  '00000000-0000-4000-8000-000000094201',
  75,
  true,
  true,
  70,
  '00000000-0000-4000-8000-000000094003'
);

insert into public.lesson_progress (
  student_id,
  lesson_id,
  status,
  progress_percent,
  started_at,
  completed_at
)
values (
  '00000000-0000-4000-8000-000000094001',
  '00000000-0000-4000-8000-000000094401',
  'COMPLETED',
  100,
  now() - interval '1 hour',
  now()
);

insert into public.quizzes (
  id,
  course_id,
  section_id,
  title,
  assessment_scope,
  is_required,
  required_for_certificate,
  passing_score,
  is_published
)
values
  (
    '00000000-0000-4000-8000-000000094601',
    '00000000-0000-4000-8000-000000094201',
    '00000000-0000-4000-8000-000000094301',
    'Module Assessment',
    'MODULE',
    true,
    true,
    70,
    false
  ),
  (
    '00000000-0000-4000-8000-000000094602',
    '00000000-0000-4000-8000-000000094201',
    null,
    'Final Examination',
    'FINAL',
    false,
    false,
    null,
    false
  );

insert into public.quiz_questions (
  id,
  quiz_id,
  question_text,
  question_type,
  position
)
values
  (
    '00000000-0000-4000-8000-000000094701',
    '00000000-0000-4000-8000-000000094601',
    'Module question?',
    'SINGLE_CHOICE',
    0
  ),
  (
    '00000000-0000-4000-8000-000000094702',
    '00000000-0000-4000-8000-000000094602',
    'Final question?',
    'SINGLE_CHOICE',
    0
  );

insert into public.question_options (
  question_id,
  option_text,
  position,
  is_correct
)
values
  (
    '00000000-0000-4000-8000-000000094701',
    'Yes',
    0,
    true
  ),
  (
    '00000000-0000-4000-8000-000000094701',
    'No',
    1,
    false
  ),
  (
    '00000000-0000-4000-8000-000000094702',
    'Yes',
    0,
    true
  ),
  (
    '00000000-0000-4000-8000-000000094702',
    'No',
    1,
    false
  );

update public.quizzes
set is_published = true
where id in (
  '00000000-0000-4000-8000-000000094601',
  '00000000-0000-4000-8000-000000094602'
);

insert into public.quiz_attempts (
  id,
  quiz_id,
  student_id,
  attempt_number,
  score,
  total_points,
  status,
  submitted_at
)
values (
  '00000000-0000-4000-8000-000000094801',
  '00000000-0000-4000-8000-000000094602',
  '00000000-0000-4000-8000-000000094001',
  1,
  65,
  100,
  'GRADED',
  now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000094001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000094001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (public.get_course_certificate_eligibility(
    '00000000-0000-4000-8000-000000094501'
  ) ->> 'lesson_completion_percent')::numeric,
  50::numeric,
  'Certificate eligibility reports the configured lesson completion percentage'
);
select is(
  (public.get_course_certificate_eligibility(
    '00000000-0000-4000-8000-000000094501'
  ) ->> 'learning_complete')::boolean,
  false,
  'A course remains incomplete below its lesson threshold'
);
select throws_ok(
  $$select public.start_quiz_attempt('00000000-0000-4000-8000-000000094601')$$,
  '23514',
  null,
  'Module assessments require all published module lessons to be complete'
);
select throws_ok(
  $$select public.start_quiz_attempt('00000000-0000-4000-8000-000000094602')$$,
  '23514',
  null,
  'A final examination is blocked below the course lesson threshold'
);

reset role;
insert into public.lesson_progress (
  student_id,
  lesson_id,
  status,
  progress_percent,
  started_at,
  completed_at
)
values (
  '00000000-0000-4000-8000-000000094001',
  '00000000-0000-4000-8000-000000094402',
  'COMPLETED',
  100,
  now() - interval '1 hour',
  now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000094001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000094001', true);
set local role authenticated;

select throws_ok(
  $$select public.start_quiz_attempt('00000000-0000-4000-8000-000000094602')$$,
  '23514',
  null,
  'A final examination is blocked until required module assessments are passed'
);

reset role;
insert into public.quiz_attempts (
  id,
  quiz_id,
  student_id,
  attempt_number,
  score,
  total_points,
  status,
  submitted_at
)
values (
  '00000000-0000-4000-8000-000000094802',
  '00000000-0000-4000-8000-000000094601',
  '00000000-0000-4000-8000-000000094001',
  1,
  80,
  100,
  'GRADED',
  now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000094001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000094001', true);
set local role authenticated;

select lives_ok(
  $$select public.start_quiz_attempt('00000000-0000-4000-8000-000000094602')$$,
  'The final examination becomes available after lesson and module requirements pass'
);
select is(
  (public.get_course_certificate_eligibility(
    '00000000-0000-4000-8000-000000094501'
  ) ->> 'required_assessments_passed')::integer,
  1,
  'The configured required-assessment count reflects the passed module assessment'
);
select is(
  (public.get_course_certificate_eligibility(
    '00000000-0000-4000-8000-000000094501'
  ) ->> 'final_exam_passed')::boolean,
  false,
  'A final score below the configured minimum does not qualify'
);

reset role;
update public.quiz_attempts
set score = 75
where id = '00000000-0000-4000-8000-000000094801';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000094001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000094001', true);
set local role authenticated;

select is(
  (public.get_course_certificate_eligibility(
    '00000000-0000-4000-8000-000000094501'
  ) ->> 'learning_complete')::boolean,
  true,
  'Required lessons, assessments, and the final exam satisfy course completion rules'
);
select is(
  (public.get_course_certificate_eligibility(
    '00000000-0000-4000-8000-000000094501'
  ) ->> 'eligible')::boolean,
  true,
  'Certificate eligibility becomes true after the final requirement is satisfied'
);
select is(
  (
    select status
    from public.enrollments
    where id = '00000000-0000-4000-8000-000000094501'
  ),
  'COMPLETED',
  'The enrollment is completed automatically when configured requirements pass'
);
select is(
  (
    select count(*)::integer
    from public.certificates
    where enrollment_id = '00000000-0000-4000-8000-000000094501'
  ),
  1,
  'A certificate is issued automatically when eligibility is reached'
);
select is(
  (
    select count(*)::integer
    from public.certificate_events
    where certificate_id = (
      select id
      from public.certificates
      where enrollment_id = '00000000-0000-4000-8000-000000094501'
    )
      and event_type = 'ISSUED'
  ),
  0,
  'Learners cannot read certificate lifecycle history'
);
select ok(
  exists (
    select 1
    from public.certificates
    where enrollment_id = '00000000-0000-4000-8000-000000094501'
      and student_id = '00000000-0000-4000-8000-000000094001'
      and course_id = '00000000-0000-4000-8000-000000094201'
      and status = 'ISSUED'
      and issued_at is not null
      and certificate_number ~ '^LP-[0-9A-F]{32}$'
      and verification_code ~ '^[0-9a-f]{32}$'
  ),
  'Issued certificate metadata and unique verification identifiers are persisted'
);

reset role;
update public.quiz_attempts
set score = score
where id = '00000000-0000-4000-8000-000000094801';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000094001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000094001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.certificates
    where enrollment_id = '00000000-0000-4000-8000-000000094501'
  ),
  1,
  'Repeated eligible events do not create duplicate certificates'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.issue_course_certificate(uuid)',
    'EXECUTE'
  ),
  'Students cannot invoke certificate issuance'
);
select ok(
  not has_table_privilege('authenticated', 'public.certificates', 'INSERT'),
  'Students cannot insert certificate records directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.certificates', 'UPDATE'),
  'Students cannot modify certificate records directly'
);
select is(
  (
    select count(*)::integer
    from public.certificates
    where enrollment_id = '00000000-0000-4000-8000-000000094501'
      and student_id = '00000000-0000-4000-8000-000000094001'
  ),
  1,
  'The learner can read their own issued certificate'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000094002","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000094002', true);
select throws_ok(
  $$select public.get_course_certificate_eligibility('00000000-0000-4000-8000-000000094501')$$,
  '42501',
  null,
  'A learner cannot read another learner’s certificate eligibility'
);
select is(
  (
    select count(*)::integer
    from public.certificates
    where enrollment_id = '00000000-0000-4000-8000-000000094501'
  ),
  0,
  'A different learner cannot read another learner’s certificate'
);

reset role;
update public.profiles
set role = 'admin'
where id = '00000000-0000-4000-8000-000000094003';
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000094003","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000094003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select ok(
  exists (
    select 1
    from public.certificates
    where enrollment_id = '00000000-0000-4000-8000-000000094501'
  )
    and exists (
      select 1
      from public.certificate_events
      where event_type = 'ISSUED'
        and certificate_id = (
          select id
          from public.certificates
          where enrollment_id = '00000000-0000-4000-8000-000000094501'
        )
    ),
  'An administrator can read the certificate and issuance history'
);

select * from finish();
rollback;
