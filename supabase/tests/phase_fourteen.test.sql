begin;

select plan(29);

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
    '00000000-0000-4000-8000-000000014001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase14-student-one@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase Fourteen Student"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000014002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase14-student-two@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Second Phase Fourteen Student"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000014003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase14-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase Fourteen Instructor"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000014004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase14-admin@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase Fourteen Administrator"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000014003';

update public.profiles
set role = 'admin'
where id = '00000000-0000-4000-8000-000000014004';

insert into public.course_categories (id, name, slug, is_active)
values (
  '00000000-0000-4000-8000-000000014101',
  'Phase Fourteen Tests',
  'phase-fourteen-tests',
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
  '00000000-0000-4000-8000-000000014201',
  '00000000-0000-4000-8000-000000014003',
  '00000000-0000-4000-8000-000000014101',
  'Verified Spanish Course',
  'verified-spanish-course',
  'Spanish',
  'BEGINNER',
  'DRAFT',
  null
);

insert into public.course_sections (id, course_id, title, position)
values (
  '00000000-0000-4000-8000-000000014301',
  '00000000-0000-4000-8000-000000014201',
  'Course unit',
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
values (
  '00000000-0000-4000-8000-000000014401',
  '00000000-0000-4000-8000-000000014301',
  'Completed lesson',
  'Complete a short Spanish lesson.',
  'TEXT',
  0,
  true
);

update public.courses
set status = 'PUBLISHED', published_at = now()
where id = '00000000-0000-4000-8000-000000014201';

insert into public.enrollments (
  id,
  student_id,
  course_id,
  status,
  enrollment_type
)
values
  (
    '00000000-0000-4000-8000-000000014501',
    '00000000-0000-4000-8000-000000014001',
    '00000000-0000-4000-8000-000000014201',
    'COMPLETED',
    'FREE'
  ),
  (
    '00000000-0000-4000-8000-000000014502',
    '00000000-0000-4000-8000-000000014002',
    '00000000-0000-4000-8000-000000014201',
    'ACTIVE',
    'FREE'
  );

insert into public.quizzes (
  id,
  course_id,
  title,
  passing_score,
  is_published
)
values (
  '00000000-0000-4000-8000-000000014601',
  '00000000-0000-4000-8000-000000014201',
  'Required assessment',
  70,
  false
);

insert into public.quiz_questions (
  id,
  quiz_id,
  question_text,
  question_type,
  position
)
values (
  '00000000-0000-4000-8000-000000014602',
  '00000000-0000-4000-8000-000000014601',
  'A verified assessment question?',
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
    '00000000-0000-4000-8000-000000014602',
    'Correct option',
    0,
    true
  ),
  (
    '00000000-0000-4000-8000-000000014602',
    'Incorrect option',
    1,
    false
  );

update public.quizzes
set is_published = true
where id = '00000000-0000-4000-8000-000000014601';

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
  '00000000-0000-4000-8000-000000014701',
  '00000000-0000-4000-8000-000000014601',
  '00000000-0000-4000-8000-000000014001',
  1,
  50,
  100,
  'GRADED',
  now()
);

insert into public.notification_preferences (
  user_id,
  certificate_updates
)
values ('00000000-0000-4000-8000-000000014001', false);

insert into public.lesson_progress (
  student_id,
  lesson_id,
  status,
  progress_percent,
  started_at,
  completed_at
)
values (
  '00000000-0000-4000-8000-000000014001',
  '00000000-0000-4000-8000-000000014401',
  'COMPLETED',
  100,
  now() - interval '1 hour',
  now()
);

insert into public.live_classes (
  id,
  course_id,
  instructor_id,
  title,
  meeting_provider,
  meeting_reference,
  scheduled_start,
  scheduled_end,
  max_participants
)
values (
  '00000000-0000-4000-8000-000000014801',
  '00000000-0000-4000-8000-000000014201',
  '00000000-0000-4000-8000-000000014003',
  'Capacity-limited session',
  'EXTERNAL',
  'https://meet.google.com/phase14-session',
  now() + interval '1 day',
  now() + interval '1 day 1 hour',
  1
);

select ok(
  to_regprocedure('public.revoke_course_certificate(uuid)') is null,
  'The legacy certificate revocation function without a reason is removed'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.live_class_registrations',
    'INSERT'
  ),
  'Learners cannot bypass the capacity-safe live class registration operation'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.register_for_live_class(uuid)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.register_for_live_class(uuid)',
      'EXECUTE'
    ),
  'Live class registration is restricted to authenticated users'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000014001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000014001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$
    select meeting_reference
    from public.live_classes
    where id = '00000000-0000-4000-8000-000000014801'
  $$,
  '42501',
  null,
  'Learners cannot read live meeting credentials directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.issue_course_certificate(uuid)',
    'EXECUTE'
  ),
  'Students have no executable certificate issuance function'
);

reset role;
update public.quiz_attempts
set score = 80
where id = '00000000-0000-4000-8000-000000014701';
set local role authenticated;

select is(
  (public.get_course_certificate_eligibility(
    '00000000-0000-4000-8000-000000014501'
  ) ->> 'eligible')::boolean,
  true,
  'A completed learner becomes eligible after the required assessment passes'
);
select is(
  (
    select count(*)::integer
    from public.certificates
    where enrollment_id = '00000000-0000-4000-8000-000000014501'
      and status = 'ISSUED'
  ),
  1,
  'An eligible completed enrollment automatically receives exactly one certificate'
);

select ok(
  not has_table_privilege('authenticated', 'public.certificate_events', 'INSERT'),
  'Certificate lifecycle history is append-only to application users'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000014001","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(
  (select count(*) > 0 from public.notifications where user_id = auth.uid()),
  'A learner can read their own workflow notifications'
);
select is(
  (
    select count(*)::integer
    from public.notifications
    where user_id = '00000000-0000-4000-8000-000000014001'
      and notification_type = 'CERTIFICATE'
  ),
  0,
  'A disabled certificate preference suppresses certificate notifications'
);

select is(
  (
    select count(*)::integer
    from public.live_classes
    where id = '00000000-0000-4000-8000-000000014801'
  ),
  1,
  'An enrolled learner can discover upcoming sessions before registering'
);
select lives_ok(
  $$select public.register_for_live_class('00000000-0000-4000-8000-000000014801')$$,
  'An eligible learner can register through the capacity-safe operation'
);
select is(
  (
    select registration_status
    from public.live_class_registrations
    where live_class_id = '00000000-0000-4000-8000-000000014801'
      and student_id = auth.uid()
  ),
  'REGISTERED',
  'A successful registration is visible to its owner'
);
select is(
  public.get_live_class_meeting_reference('00000000-0000-4000-8000-000000014801'),
  'https://meet.google.com/phase14-session',
  'Registered learners can retrieve the host-provided meeting link'
);
select throws_ok(
  $$
    insert into public.live_class_registrations (
      live_class_id,
      student_id
    )
    values (
      '00000000-0000-4000-8000-000000014801',
      '00000000-0000-4000-8000-000000014001'
    )
  $$,
  '42501',
  null,
  'Learners cannot bypass registration RPC checks with a direct insert'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000014002","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000014002',
  true
);
select throws_ok(
  $$select public.register_for_live_class('00000000-0000-4000-8000-000000014801')$$,
  '23514',
  null,
  'Concurrent learner registration cannot exceed class capacity'
);
select throws_ok(
  $$select public.get_live_class_meeting_reference('00000000-0000-4000-8000-000000014801')$$,
  '42501',
  null,
  'Unregistered learners cannot retrieve private meeting links'
);

reset role;
insert into public.live_classes (
  id,
  course_id,
  instructor_id,
  title,
  meeting_provider,
  meeting_reference,
  scheduled_start,
  scheduled_end,
  status
)
values (
  '00000000-0000-4000-8000-000000014802',
  '00000000-0000-4000-8000-000000014201',
  '00000000-0000-4000-8000-000000014003',
  'Completed session',
  'EXTERNAL',
  'https://meet.google.com/completed-session',
  now() - interval '2 hours',
  now() - interval '1 hour',
  'COMPLETED'
);
insert into public.live_class_registrations (
  live_class_id,
  student_id,
  registration_status
)
values (
  '00000000-0000-4000-8000-000000014802',
  '00000000-0000-4000-8000-000000014001',
  'REGISTERED'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000014003","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000014003',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.record_live_class_attendance(
      '00000000-0000-4000-8000-000000014802',
      '00000000-0000-4000-8000-000000014001',
      'ATTENDED'
    )
  $$,
  'The course instructor can record attendance after a completed class'
);
select is(
  (
    select registration_status
    from public.live_class_registrations
    where live_class_id = '00000000-0000-4000-8000-000000014802'
      and student_id = '00000000-0000-4000-8000-000000014001'
  ),
  'ATTENDED',
  'The instructor attendance decision is recorded on the registration'
);
select is(
  (
    select count(*)::integer
    from public.live_class_attendance_events
    where live_class_id = '00000000-0000-4000-8000-000000014802'
  ),
  0,
  'Instructors cannot read administrative attendance history'
);
select is(
  (
    select student_name
    from public.get_live_class_roster('00000000-0000-4000-8000-000000014802')
    where student_id = '00000000-0000-4000-8000-000000014001'
  ),
  'Phase Fourteen Student',
  'The instructor can review the session roster through a role-checked operation'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000014004","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000014004',
  true
);
set local role authenticated;
select is(
  (
    select count(*)::integer
    from public.notifications
    where user_id = '00000000-0000-4000-8000-000000014001'
  ),
  0,
  'Administrators cannot read another user’s private notification content'
);
select is(
  (
    select count(*)::integer
    from public.certificate_events
    where event_type = 'ISSUED'
  ),
  1,
  'Administrators can review certificate issuance history'
);
select is(
  (
    select count(*)::integer
    from public.live_class_attendance_events
    where live_class_id = '00000000-0000-4000-8000-000000014802'
      and attendance_source = 'INSTRUCTOR'
  ),
  1,
  'Administrators can audit instructor-recorded attendance'
);

select throws_ok(
  $$select public.revoke_course_certificate(
    (select id from public.certificates limit 1),
    'short'
  )$$,
  '23514',
  null,
  'Certificate revocation requires a meaningful reason'
);
select set_config(
  'test.phase14_certificate_code',
  (
    select verification_code
    from public.certificates
    where enrollment_id = '00000000-0000-4000-8000-000000014501'
  ),
  true
);
select lives_ok(
  $$select public.revoke_course_certificate(
    (select id from public.certificates limit 1),
    'Duplicate record confirmed by support review.'
  )$$,
  'An administrator can revoke a certificate with an audited reason'
);
select is(
  (
    select status
    from public.certificates
    where enrollment_id = '00000000-0000-4000-8000-000000014501'
  ),
  'REVOKED',
  'Revocation changes the certificate lifecycle state'
);
select is(
  (
    select count(*)::integer
    from public.certificate_events
    where event_type = 'REVOKED'
      and reason = 'Duplicate record confirmed by support review.'
  ),
  1,
  'The revocation event and reason are retained in history'
);

reset role;
set local role anon;
select is(
  (
    select status
    from public.verify_certificate(
      current_setting('test.phase14_certificate_code')
    )
  ),
  'REVOKED',
  'Public verification reports revoked certificates without exposing revocation reasons'
);

select * from finish();
rollback;
