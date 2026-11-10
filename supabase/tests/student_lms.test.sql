begin;

select plan(25);

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
    '00000000-0000-4000-8000-000000004001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'lms-student-one@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"LMS Student One"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'lms-student-two@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"LMS Student Two"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'lms-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"LMS Instructor"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000004003';

insert into public.course_categories (id, name, slug, is_active)
values (
  '00000000-0000-4000-8000-000000004101',
  'LMS Tests',
  'lms-tests',
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
  '00000000-0000-4000-8000-000000004201',
  '00000000-0000-4000-8000-000000004003',
  '00000000-0000-4000-8000-000000004101',
  'LMS Sample Course',
  'lms-sample-course',
  'Spanish',
  'BEGINNER',
  'DRAFT',
  null
);

insert into public.course_sections (id, course_id, title, position)
values (
  '00000000-0000-4000-8000-000000004301',
  '00000000-0000-4000-8000-000000004201',
  'First unit',
  0
);

insert into public.lessons (
  id,
  section_id,
  title,
  description,
  content_type,
  video_storage_path,
  duration_seconds,
  position,
  is_published
)
values
  (
    '00000000-0000-4000-8000-000000004401',
    '00000000-0000-4000-8000-000000004301',
    'Published video lesson',
    null,
    'VIDEO',
    '00000000-0000-4000-8000-000000004201/00000000-0000-4000-8000-000000004401/lesson.mp4',
    100,
    0,
    true
  ),
  (
    '00000000-0000-4000-8000-000000004402',
    '00000000-0000-4000-8000-000000004301',
    'Next reading lesson',
    'Read the next lesson.',
    'TEXT',
    null,
    null,
    1,
    true
  ),
  (
    '00000000-0000-4000-8000-000000004403',
    '00000000-0000-4000-8000-000000004301',
    'Unpublished lesson',
    null,
    'VIDEO',
    '00000000-0000-4000-8000-000000004201/00000000-0000-4000-8000-000000004403/draft.mp4',
    60,
    2,
    false
  );

update public.courses
set status = 'PUBLISHED', published_at = now()
where id = '00000000-0000-4000-8000-000000004201';

insert into public.lesson_resources (
  id,
  lesson_id,
  title,
  resource_type,
  storage_path,
  storage_bucket,
  external_url
)
values
  (
    '00000000-0000-4000-8000-000000004601',
    '00000000-0000-4000-8000-000000004401',
    'Published lesson notes',
    'DOCUMENT',
    '00000000-0000-4000-8000-000000004201/00000000-0000-4000-8000-000000004401/notes.pdf',
    'learning-resources',
    null
  ),
  (
    '00000000-0000-4000-8000-000000004602',
    '00000000-0000-4000-8000-000000004403',
    'Unpublished lesson notes',
    'DOCUMENT',
    '00000000-0000-4000-8000-000000004201/00000000-0000-4000-8000-000000004403/notes.pdf',
    'learning-resources',
    null
  );

insert into public.enrollments (
  id,
  student_id,
  course_id,
  status,
  enrollment_type
)
values (
  '00000000-0000-4000-8000-000000004501',
  '00000000-0000-4000-8000-000000004001',
  '00000000-0000-4000-8000-000000004201',
  'ACTIVE',
  'FREE'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values
  (
    'lesson-media',
    '00000000-0000-4000-8000-000000004201/00000000-0000-4000-8000-000000004401/lesson.mp4',
    '00000000-0000-4000-8000-000000004003',
    '{}'::jsonb
  ),
  (
    'lesson-media',
    '00000000-0000-4000-8000-000000004201/00000000-0000-4000-8000-000000004403/draft.mp4',
    '00000000-0000-4000-8000-000000004003',
    '{}'::jsonb
  ),
  (
    'learning-resources',
    '00000000-0000-4000-8000-000000004201/00000000-0000-4000-8000-000000004401/notes.pdf',
    '00000000-0000-4000-8000-000000004003',
    '{}'::jsonb
  ),
  (
    'learning-resources',
    '00000000-0000-4000-8000-000000004201/00000000-0000-4000-8000-000000004403/notes.pdf',
    '00000000-0000-4000-8000-000000004003',
    '{}'::jsonb
  );

select ok(
  has_function_privilege(
    'authenticated',
    'public.record_lesson_playback_position(uuid,integer)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.record_lesson_playback_position(uuid,integer)',
      'EXECUTE'
    ),
  'Playback position writes are available only to authenticated users'
);
select ok(
  not has_table_privilege('authenticated', 'public.lesson_progress', 'INSERT')
    and not has_table_privilege('authenticated', 'public.lesson_progress', 'UPDATE'),
  'Students cannot directly insert or update lesson progress'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$select public.record_lesson_access('00000000-0000-4000-8000-000000004401')$$,
  'An enrolled student can record access to a published lesson'
);
select lives_ok(
  $$select public.record_lesson_playback_position(
    '00000000-0000-4000-8000-000000004401',
    90
  )$$,
  'An enrolled student can save lesson playback'
);
select is(
  (
    select furthest_position_seconds
    from public.lesson_progress
    where lesson_id = '00000000-0000-4000-8000-000000004401'
  ),
  10,
  'A single client report cannot claim near-complete media progress'
);
select throws_ok(
  $$select public.record_lesson_playback_position(
    '00000000-0000-4000-8000-000000004401',
    604801
  )$$,
  '23514',
  null,
  'Playback positions are bounded to the supported duration'
);
select throws_ok(
  $$select public.complete_lesson('00000000-0000-4000-8000-000000004401', 'MEDIA')$$,
  '23514',
  null,
  'Media completion requires trusted accumulated playback progress'
);
select throws_ok(
  $$
    insert into public.lesson_progress (
      student_id,
      lesson_id,
      status,
      progress_percent,
      started_at
    )
    values (
      '00000000-0000-4000-8000-000000004001',
      '00000000-0000-4000-8000-000000004401',
      'IN_PROGRESS',
      20,
      now()
    )
  $$,
  '42501',
  null,
  'Students cannot bypass lesson progress RPCs with direct writes'
);
select is(
  (
    select count(*)::integer
    from public.lesson_resources
    where lesson_id = '00000000-0000-4000-8000-000000004401'
  ),
  1,
  'Enrolled learners can read resources for published lessons'
);
select is(
  (
    select count(*)::integer
    from public.lesson_resources
    where lesson_id = '00000000-0000-4000-8000-000000004403'
  ),
  0,
  'Enrolled learners cannot enumerate resources for unpublished lessons'
);
select ok(
  not public.storage_can_access_lesson(
    '00000000-0000-4000-8000-000000004201/00000000-0000-4000-8000-000000004403/draft.mp4',
    'lesson-media'
  ),
  'Storage access denies media attached to unpublished lessons'
);

reset role;
update public.lesson_progress
set playback_updated_at = clock_timestamp() - interval '1 minute'
where student_id = '00000000-0000-4000-8000-000000004001'
  and lesson_id = '00000000-0000-4000-8000-000000004401';
set local role authenticated;

select lives_ok(
  $$select public.record_lesson_playback_position(
    '00000000-0000-4000-8000-000000004401',
    90
  )$$,
  'Playback progress can advance over elapsed time'
);
select is(
  (
    select furthest_position_seconds
    from public.lesson_progress
    where lesson_id = '00000000-0000-4000-8000-000000004401'
  ),
  90,
  'The furthest position reflects elapsed playback'
);
select lives_ok(
  $$select public.complete_lesson('00000000-0000-4000-8000-000000004401', 'MEDIA')$$,
  'Media completion succeeds after the trusted playback threshold'
);
select lives_ok(
  $$select public.record_lesson_playback_position(
    '00000000-0000-4000-8000-000000004401',
    20
  )$$,
  'Learners can seek backward without violating progress constraints'
);
select is(
  (
    select last_position_seconds::text || ':' || furthest_position_seconds::text
    from public.lesson_progress
    where lesson_id = '00000000-0000-4000-8000-000000004401'
  ),
  '20:90',
  'Resume position can move backward while furthest progress is retained'
);
select is(
  (
    select lesson_id
    from public.get_student_course_resume()
    where course_id = '00000000-0000-4000-8000-000000004201'
  ),
  '00000000-0000-4000-8000-000000004402'::uuid,
  'Course resume selects the next unstarted lesson after a completed lesson'
);
select throws_ok(
  $$select public.complete_lesson('00000000-0000-4000-8000-000000004402', 'MEDIA')$$,
  '23514',
  null,
  'Text lessons cannot be completed through the media threshold'
);
select lives_ok(
  $$select public.complete_lesson('00000000-0000-4000-8000-000000004402', 'MANUAL')$$,
  'Learners can explicitly complete a reading lesson'
);
select is(
  (
    select status
    from public.lesson_progress
    where lesson_id = '00000000-0000-4000-8000-000000004402'
  ),
  'COMPLETED',
  'Manual completion persists for a reading lesson'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004002","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004002',
  true
);
select throws_ok(
  $$select public.record_lesson_access('00000000-0000-4000-8000-000000004401')$$,
  '42501',
  null,
  'A learner without enrollment cannot record lesson access'
);
select is(
  (select count(*)::integer from public.lesson_resources),
  0,
  'An unenrolled learner cannot read lesson resources'
);
select is(
  (select count(*)::integer from public.lesson_progress),
  0,
  'Learners cannot read another student progress'
);
select ok(
  not public.storage_can_access_lesson(
    '00000000-0000-4000-8000-000000004201/00000000-0000-4000-8000-000000004401/notes.pdf',
    'learning-resources'
  ),
  'An unenrolled learner cannot authorize a private lesson resource'
);
select throws_ok(
  $$select public.record_lesson_playback_position(
    '00000000-0000-4000-8000-000000004401',
    10
  )$$,
  '42501',
  null,
  'A learner without enrollment cannot write playback progress'
);

select * from finish();
rollback;
