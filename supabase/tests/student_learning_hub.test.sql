begin;

select plan(17);

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
    '00000000-0000-4000-8000-000000003001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'learning-hub-student-one@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Learning Hub Student One"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000003002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'learning-hub-student-two@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Learning Hub Student Two"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000003003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'learning-hub-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Learning Hub Instructor"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000003003';

insert into public.course_categories (id, name, slug, is_active)
values (
  '00000000-0000-4000-8000-000000003101',
  'Learning Hub Tests',
  'learning-hub-tests',
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
  '00000000-0000-4000-8000-000000003201',
  '00000000-0000-4000-8000-000000003003',
  '00000000-0000-4000-8000-000000003101',
  'Learning Hub Sample Course',
  'learning-hub-sample-course',
  'Spanish',
  'BEGINNER',
  'DRAFT',
  null
);

insert into public.course_sections (id, course_id, title, position)
values (
  '00000000-0000-4000-8000-000000003301',
  '00000000-0000-4000-8000-000000003201',
  'First unit',
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
  '00000000-0000-4000-8000-000000003401',
  '00000000-0000-4000-8000-000000003301',
  'A real completed lesson',
  'Complete a short Spanish reading.',
  'TEXT',
  0,
  true
);

update public.courses
set status = 'PUBLISHED', published_at = now()
where id = '00000000-0000-4000-8000-000000003201';

insert into public.enrollments (
  id,
  student_id,
  course_id,
  status,
  enrollment_type,
  enrolled_at
)
values
  (
    '00000000-0000-4000-8000-000000003501',
    '00000000-0000-4000-8000-000000003001',
    '00000000-0000-4000-8000-000000003201',
    'ACTIVE',
    'FREE',
    now() - interval '1 day'
  ),
  (
    '00000000-0000-4000-8000-000000003502',
    '00000000-0000-4000-8000-000000003002',
    '00000000-0000-4000-8000-000000003201',
    'ACTIVE',
    'FREE',
    now() - interval '1 day'
  );

insert into public.lesson_progress (
  id,
  student_id,
  lesson_id,
  status,
  progress_percent,
  started_at,
  completed_at
)
values
  (
    '00000000-0000-4000-8000-000000003601',
    '00000000-0000-4000-8000-000000003001',
    '00000000-0000-4000-8000-000000003401',
    'COMPLETED',
    100,
    now() - interval '1 hour',
    now() - interval '1 minute'
  ),
  (
    '00000000-0000-4000-8000-000000003602',
    '00000000-0000-4000-8000-000000003002',
    '00000000-0000-4000-8000-000000003401',
    'COMPLETED',
    100,
    now() - interval '1 hour',
    now() - interval '1 minute'
  );

select ok(
  has_table_privilege('authenticated', 'public.student_learning_goals', 'SELECT')
    and not has_table_privilege('anon', 'public.student_learning_goals', 'SELECT'),
  'Learning goals are available only to authenticated users'
);
select ok(
  has_function_privilege('authenticated', 'public.get_student_course_progress()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_student_course_progress()', 'EXECUTE'),
  'Course progress aggregation is limited to authenticated users'
);
select ok(
  has_function_privilege('authenticated', 'public.get_student_learning_activity(integer,integer,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_student_learning_activity(integer,integer,text)', 'EXECUTE'),
  'Student activity is limited to authenticated users'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000003001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003001',
  true
);

select lives_ok(
  $$
    insert into public.student_learning_goals (
      student_id,
      daily_lesson_target,
      weekly_lesson_target,
      timezone,
      preferred_language
    )
    values (
      '00000000-0000-4000-8000-000000003001',
      2,
      8,
      'America/Los_Angeles',
      'Spanish'
    )
  $$,
  'Students can create their own learning goals and preferences'
);
select is(
  (
    select daily_lesson_target
    from public.student_learning_goals
    where student_id = '00000000-0000-4000-8000-000000003001'
  ),
  2,
  'Students can read their own learning goal'
);
select is(
  (
    select count(*)::integer
    from public.student_learning_goals
    where student_id = '00000000-0000-4000-8000-000000003002'
  ),
  0,
  'Students cannot read another student learning goal'
);
select throws_ok(
  $$
    insert into public.student_learning_goals (student_id)
    values ('00000000-0000-4000-8000-000000003002')
  $$,
  '42501',
  null,
  'Students cannot create goals for another student'
);
select throws_ok(
  $$
    insert into public.student_learning_goals (student_id, daily_lesson_target)
    values ('00000000-0000-4000-8000-000000003001', 21)
  $$,
  '23514',
  null,
  'Daily goal values are constrained by the database'
);
select throws_ok(
  $$
    insert into public.student_learning_goals (student_id, timezone)
    values ('00000000-0000-4000-8000-000000003001', 'not/a-timezone')
  $$,
  '23514',
  null,
  'Learning preferences reject invalid timezones'
);
select is(
  (
    select completed_lessons
    from public.get_student_course_progress()
    where course_id = '00000000-0000-4000-8000-000000003201'
  ),
  1,
  'Progress aggregation returns the current student completion count'
);
select is(
  (
    select total_lessons
    from public.get_student_course_progress()
    where course_id = '00000000-0000-4000-8000-000000003201'
  ),
  1,
  'Progress aggregation counts published lessons only'
);
select is(
  (
    select count(*)::integer
    from public.get_student_learning_activity(0, 20, null)
  ),
  4,
  'Activity history includes the earned certificate with enrollment and lesson events'
);
select is(
  (
    select count(*)::integer
    from public.get_student_learning_activity(0, 20, 'CERTIFICATE_EARNED')
  ),
  1,
  'Eligible completed learning creates a certificate activity event'
);
select is(
  (
    select count(*)::integer
    from public.get_student_learning_activity(0, 20, 'COURSE_ENROLLED')
  ),
  1,
  'Activity filters return the requested event type'
);
select is(
  (select current_streak from public.get_student_learning_streak('UTC')),
  1,
  'Current streak uses genuine completed lesson activity'
);
select throws_ok(
  $$select * from public.get_student_learning_streak('not/a-timezone')$$,
  '23514',
  null,
  'Streak calculation rejects an invalid timezone'
);
select throws_ok(
  $$select * from public.get_student_learning_activity(0, 20, 'PRIVATE_EVENT')$$,
  '23514',
  null,
  'Activity pagination rejects unsupported event types'
);

select * from finish();
rollback;
