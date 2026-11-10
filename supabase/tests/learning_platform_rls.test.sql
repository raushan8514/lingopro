begin;

select plan(84);

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
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase5-student-one@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase Five Learner","role":"admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase5-student-two@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Second Learner"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase5-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase Five Instructor"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase5-admin@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase Five Admin"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000000203';

update public.profiles
set role = 'admin'
where id = '00000000-0000-4000-8000-000000000204';

insert into public.course_categories (id, name, slug, is_active)
values
  ('00000000-0000-4000-8000-000000000401', 'Languages', 'languages', true),
  ('00000000-0000-4000-8000-000000000402', 'Hidden category', 'hidden-category', false);

insert into public.courses (
  id,
  instructor_id,
  category_id,
  title,
  slug,
  short_description,
  language,
  difficulty,
  price_cents,
  currency,
  status,
  published_at
)
values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000401',
    'French Foundations',
    'french-foundations',
    'A test course',
    'French',
    'BEGINNER',
    0,
    'USD',
    'DRAFT',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000401',
    'Draft Course',
    'draft-course',
    'Not public',
    'French',
    'BEGINNER',
    0,
    'USD',
    'DRAFT',
    null
  );

insert into public.course_sections (id, course_id, title, position)
values (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000301',
  'Getting Started',
  0
), (
  '00000000-0000-4000-8000-000000000502',
  '00000000-0000-4000-8000-000000000302',
  'Course content',
  0
);

insert into public.lessons (
  id,
  section_id,
  title,
  content_type,
  content,
  video_storage_path,
  duration_seconds,
  position,
  is_preview,
  is_published
)
values
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000501',
    'Preview Lesson',
    'VIDEO',
    '{"body":"Preview"}',
    '00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000601/preview.mp4',
    60,
    0,
    true,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000501',
    'Private Lesson',
    'TEXT',
    '{"body":"Enrolled learners only"}',
    null,
    60,
    1,
    false,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000501',
    'Unpublished Lesson',
    'TEXT',
    '{}',
    null,
    60,
    2,
    false,
    false
  ),
  (
    '00000000-0000-4000-8000-000000000604',
    '00000000-0000-4000-8000-000000000502',
    'Draft course reading',
    'TEXT',
    '{"body":"A complete published lesson for the course."}',
    null,
    60,
    0,
    false,
    true
  );

update public.courses
set status = 'PUBLISHED', published_at = now()
where id = '00000000-0000-4000-8000-000000000301';

insert into public.lesson_resources (
  id,
  lesson_id,
  title,
  resource_type,
  storage_path,
  storage_bucket,
  external_url
)
values (
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000602',
  'Lesson notes',
  'DOCUMENT',
  '00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000602/notes.pdf',
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
values
  (
    '00000000-0000-4000-8000-000000001001',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000301',
    'ACTIVE',
    'FREE'
  ),
  (
    '00000000-0000-4000-8000-000000001002',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000301',
    'COMPLETED',
    'FREE'
  );

insert into public.quizzes (
  id,
  course_id,
  lesson_id,
  assessment_scope,
  title,
  is_published
)
values (
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000602',
  'LESSON_CHECKPOINT',
  'French Basics Quiz',
  false
);

insert into public.quiz_questions (
  id,
  quiz_id,
  question_text,
  question_type,
  explanation,
  points,
  position,
  grading_mode,
  answer_key
)
values
  (
    '00000000-0000-4000-8000-000000000801',
    '00000000-0000-4000-8000-000000000901',
    'Choose the correct greeting.',
    'SINGLE_CHOICE',
    'Bonjour is the correct greeting.',
    1.50,
    0,
    'AUTO',
    null
  ),
  (
    '00000000-0000-4000-8000-000000000802',
    '00000000-0000-4000-8000-000000000901',
    'Translate hello.',
    'FILL_IN_THE_BLANK',
    'The answer will be graded by an instructor.',
    1.00,
    1,
    'MANUAL',
    null
  );

insert into public.question_options (id, question_id, option_text, position, is_correct)
values
  (
    '00000000-0000-4000-8000-000000000911',
    '00000000-0000-4000-8000-000000000801',
    'Bonjour',
    0,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000912',
    '00000000-0000-4000-8000-000000000801',
    'Merci',
    1,
    false
  );

update public.quizzes
set is_published = true
where id = '00000000-0000-4000-8000-000000000901';

insert into public.subscription_plans (
  id,
  name,
  slug,
  price_cents,
  currency,
  billing_interval,
  interval_count,
  is_active
)
values
  (
    '00000000-0000-4000-8000-000000001101',
    'Monthly',
    'monthly',
    999,
    'USD',
    'MONTH',
    1,
    true
  ),
  (
    '00000000-0000-4000-8000-000000001102',
    'Retired',
    'retired',
    499,
    'USD',
    'MONTH',
    1,
    false
  );

insert into public.subscriptions (
  id,
  student_id,
  plan_id,
  status,
  provider
)
values
  (
    '00000000-0000-4000-8000-000000001201',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000001101',
    'ACTIVE',
    'MANUAL'
  ),
  (
    '00000000-0000-4000-8000-000000001202',
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000001101',
    'ACTIVE',
    'MANUAL'
  );

insert into public.payments (
  id,
  student_id,
  subscription_id,
  amount_cents,
  currency,
  provider,
  status,
  paid_at
)
values
  (
    '00000000-0000-4000-8000-000000001301',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000001201',
    999,
    'USD',
    'MANUAL',
    'SUCCEEDED',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000001302',
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000001202',
    999,
    'USD',
    'MANUAL',
    'SUCCEEDED',
    now()
  );

insert into public.payment_events (provider, provider_event_id, event_type)
values ('MANUAL', 'phase5-event-001', 'payment.captured');

insert into public.certificates (
  id,
  student_id,
  course_id,
  enrollment_id,
  certificate_number,
  verification_code,
  certificate_storage_path,
  status
)
values (
  '00000000-0000-4000-8000-000000001401',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000001002',
  'LP-PHASE5-0001',
  'abcdefabcdefabcdefabcdefabcdefab',
  '00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000001401',
  'ISSUED'
);

insert into public.notifications (
  id,
  user_id,
  title,
  message,
  notification_type
)
values
  (
    '00000000-0000-4000-8000-000000001501',
    '00000000-0000-4000-8000-000000000201',
    'Welcome',
    'Welcome to the course.',
    'COURSE'
  ),
  (
    '00000000-0000-4000-8000-000000001502',
    '00000000-0000-4000-8000-000000000202',
    'Private notice',
    'Only the recipient can read this.',
    'SYSTEM'
  );

insert into public.live_classes (
  id,
  course_id,
  instructor_id,
  title,
  meeting_provider,
  meeting_reference,
  scheduled_start,
  scheduled_end
)
values (
  '00000000-0000-4000-8000-000000001601',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000203',
  'Practice session',
  'EXTERNAL',
  'https://meet.example.test/session/secret',
  now() + interval '1 day',
  now() + interval '1 day 1 hour'
);

insert into public.live_class_registrations (
  id,
  live_class_id,
  student_id
)
values (
  '00000000-0000-4000-8000-000000001701',
  '00000000-0000-4000-8000-000000001601',
  '00000000-0000-4000-8000-000000000201'
);

insert into public.platform_settings (setting_key, setting_value, is_public)
values
  ('public.site_name', '"LingoPro"'::jsonb, true),
  ('private.internal_mode', 'true'::jsonb, false);

select throws_ok(
  $$
    insert into public.payments (
      student_id,
      subscription_id,
      amount_cents,
      currency,
      provider,
      status
    )
    values (
      '00000000-0000-4000-8000-000000000202',
      '00000000-0000-4000-8000-000000001201',
      999,
      'USD',
      'MANUAL',
      'SUCCEEDED'
    )
  $$,
  '23503',
  null,
  'Payments must belong to the referenced student subscription'
);
select throws_ok(
  $$
    insert into public.certificates (
      student_id,
      course_id,
      enrollment_id,
      certificate_number,
      verification_code
    )
    values (
      '00000000-0000-4000-8000-000000000202',
      '00000000-0000-4000-8000-000000000301',
      '00000000-0000-4000-8000-000000001001',
      'LP-PHASE5-WRONG-OWNER',
      'fedcbafedcbafedcbafedcbafedcbafe'
    )
  $$,
  '23503',
  null,
  'Certificates must match the referenced student and course enrollment'
);
select throws_ok(
  $$
    insert into public.live_classes (
      course_id,
      instructor_id,
      title,
      meeting_provider,
      meeting_reference,
      scheduled_start,
      scheduled_end
    )
    values (
      '00000000-0000-4000-8000-000000000301',
      '00000000-0000-4000-8000-000000000202',
      'Wrong instructor',
      'EXTERNAL',
      'private',
      now() + interval '1 day',
      now() + interval '1 day 1 hour'
    )
  $$,
  '23503',
  null,
  'Live classes must use the course owner as instructor'
);
select throws_ok(
  $$
    insert into public.quizzes (
      course_id,
      lesson_id,
      title
    )
    values (
      '00000000-0000-4000-8000-000000000302',
      '00000000-0000-4000-8000-000000000602',
      'Cross-course quiz'
    )
  $$,
  '23503',
  null,
  'A quiz lesson must belong to the quiz course'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values
  (
    'course-thumbnails',
    '00000000-0000-4000-8000-000000000301/thumbnail.webp',
    '00000000-0000-4000-8000-000000000203',
    '{}'::jsonb
  ),
  (
    'lesson-media',
    '00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000601/preview.mp4',
    '00000000-0000-4000-8000-000000000203',
    '{}'::jsonb
  ),
  (
    'learning-resources',
    '00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000602/notes.pdf',
    '00000000-0000-4000-8000-000000000203',
    '{}'::jsonb
  ),
  (
    'user-avatars',
    '00000000-0000-4000-8000-000000000201/avatar.webp',
    '00000000-0000-4000-8000-000000000201',
    '{}'::jsonb
  ),
  (
    'certificates',
    '00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000001401',
    '00000000-0000-4000-8000-000000000203',
    '{}'::jsonb
  );

set local role anon;
select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
select set_config('request.jwt.claim.role', 'anon', true);

select is(
  (select count(*)::integer from public.courses),
  1,
  'Anonymous visitors can read published courses only'
);
select is(
  (select count(*)::integer from public.course_categories),
  1,
  'Anonymous visitors can read active categories only'
);
select ok(
  not has_table_privilege('anon', 'public.payments', 'SELECT'),
  'Anonymous visitors have no payment table privilege'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.storage_can_access_lesson(text,text)',
    'EXECUTE'
  ),
  'Anonymous visitors cannot call private lesson storage authorization'
);
select is(
  public.is_valid_external_url('https://cdn.example.test/video.mp4'),
  true,
  'Valid external HTTP URLs are accepted'
);
select is(
  public.is_valid_external_url('https://learner:password@example.test/video'),
  false,
  'External URLs cannot embed user credentials'
);
select is(
  public.is_valid_external_url('https:///missing-host'),
  false,
  'External URLs require a hostname'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'course-thumbnails'
  ),
  1,
  'Anonymous visitors can read public course thumbnail objects'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'lesson-media'
  ),
  0,
  'Anonymous visitors cannot read private lesson media objects'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000201',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.profiles),
  1,
  'Students can read only their own profile'
);
select is(
  (select count(*)::integer from public.enrollments),
  2,
  'Students can read only their own enrollments'
);
select is(
  (
    select count(*)::integer
    from public.enrollments
    where student_id = '00000000-0000-4000-8000-000000000202'
  ),
  0,
  'Students cannot read another learner enrollment'
);
select is(
  (
    select count(*)::integer
    from public.courses
    where status = 'DRAFT'
  ),
  0,
  'Students cannot read draft courses'
);
select is(
  (
    select count(*)::integer
    from public.lessons
    where section_id = '00000000-0000-4000-8000-000000000501'
  ),
  2,
  'Students can read published lessons in an enrolled course only'
);
select lives_ok(
  $$select public.record_lesson_access('00000000-0000-4000-8000-000000000602')$$,
  'Students can record access to their own published lesson'
);
select throws_ok(
  $$select public.record_lesson_playback_position(
    '00000000-0000-4000-8000-000000000601',
    61
  )$$,
  '23514',
  null,
  'Progress playback position cannot exceed lesson duration'
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
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000602',
      'IN_PROGRESS',
      20,
      now()
    )
  $$,
  '42501',
  null,
  'Students cannot bypass the trusted progress operations with direct writes'
);
select throws_ok(
  $$
    select public.complete_course_enrollment(
      '00000000-0000-4000-8000-000000001001'
    )
  $$,
  '23514',
  null,
  'Course completion requires progress for every published lesson'
);

select set_config(
  'test.quiz_attempt_id',
  public.start_quiz_attempt('00000000-0000-4000-8000-000000000901')::text,
  true
);
select lives_ok(
  $$
    select public.save_quiz_answer(
      current_setting('test.quiz_attempt_id')::uuid,
      '00000000-0000-4000-8000-000000000801',
      array['00000000-0000-4000-8000-000000000911'::uuid],
      null,
      false
    )
  $$,
  'Students can save answers only through the trusted operation'
);
select lives_ok(
  $$
    select public.save_quiz_answer(
      current_setting('test.quiz_attempt_id')::uuid,
      '00000000-0000-4000-8000-000000000802',
      '{}',
      'Bonjour',
      true
    )
  $$,
  'Students can autosave text responses and review flags'
);
select is(
  (
    select count(*)::integer
    from public.quiz_attempt_questions
    where attempt_id = current_setting('test.quiz_attempt_id')::uuid
  ),
  2,
  'Question order is persisted for every attempt question'
);
select throws_ok(
  $$
    insert into public.quiz_answers (
      attempt_id, question_id, selected_option_ids
    )
    values (
      current_setting('test.quiz_attempt_id')::uuid,
      '00000000-0000-4000-8000-000000000801',
      array['00000000-0000-4000-8000-000000000911'::uuid]
    )
  $$,
  '42501',
  null,
  'Students cannot bypass answer validation with direct table writes'
);
select throws_ok(
  $$
    select public.save_quiz_answer(
      current_setting('test.quiz_attempt_id')::uuid,
      '00000000-0000-4000-8000-000000000801',
      array['00000000-0000-4000-8000-000000009999'::uuid],
      null,
      false
    )
  $$,
  '23514',
  null,
  'The answer operation rejects options outside the question'
);
select throws_ok(
  $$select public.start_quiz_attempt('00000000-0000-4000-8000-000000000901')$$,
  '23514',
  null,
  'Students cannot create concurrent attempts when the setting disallows them'
);
select throws_ok(
  $$
    select is_correct
    from public.question_options
    where question_id = '00000000-0000-4000-8000-000000000801'
  $$,
  '42501',
  null,
  'Students cannot read correct answer flags'
);
select throws_ok(
  $$
    select answer_key
    from public.quiz_questions
    where id = '00000000-0000-4000-8000-000000000802'
  $$,
  '42501',
  null,
  'Students cannot read answer keys before submission'
);
select lives_ok(
  $$
    select *
    from public.submit_quiz_attempt(current_setting('test.quiz_attempt_id')::uuid)
  $$,
  'Quiz scores are calculated by the trusted database operation'
);
select is(
  jsonb_typeof(
    public.get_student_quiz_attempt(
      current_setting('test.quiz_attempt_id')::uuid
    ) #> '{questions,0,options,0,is_correct}'
  ),
  'null',
  'Student attempt results do not reveal correct choices unless configured'
);
select is(
  (
    select status
    from public.quiz_attempts
    where id = current_setting('test.quiz_attempt_id')::uuid
  ),
  'PENDING_REVIEW',
  'Manual answers are held for instructor grading'
);
select is(
  (
    select score
    from public.quiz_attempts
    where id = current_setting('test.quiz_attempt_id')::uuid
  ),
  1.50::numeric,
  'Automatic scoring awards points only for correct choices'
);
select throws_ok(
  $$
    select *
    from public.get_quiz_answer_key('00000000-0000-4000-8000-000000000901')
  $$,
  '42501',
  null,
  'Students cannot read the instructor answer key'
);

select is(
  (select count(*)::integer from public.payments),
  1,
  'Students can read their own payment records only'
);
select is(
  (
    select count(*)::integer
    from public.payments
    where student_id = '00000000-0000-4000-8000-000000000202'
  ),
  0,
  'Students cannot read another learner payments'
);
select is(
  (select count(*)::integer from public.certificates),
  1,
  'Students can read their own certificates'
);
select is(
  (
    select count(*)::integer
    from public.verify_certificate('abcdefabcdefabcdefabcdefabcdefab')
  ),
  1,
  'Public certificate verification returns a valid certificate'
);
select ok(
  (select count(*) > 0 from public.notifications where user_id = auth.uid())
    and not exists (
      select 1
      from public.notifications
      where user_id <> auth.uid()
    ),
  'Users can read only their own notifications'
);
select lives_ok(
  $$select public.mark_notification_read('00000000-0000-4000-8000-000000001501')$$,
  'Users can mark their own notifications as read'
);
select ok(
  (
    select is_read
    from public.notifications
    where id = '00000000-0000-4000-8000-000000001501'
  ),
  'Notification read state is persisted'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.live_classes',
    'meeting_reference',
    'SELECT'
  ),
  'Authenticated users cannot select live meeting credentials directly'
);
select is(
  public.get_live_class_meeting_reference('00000000-0000-4000-8000-000000001601'),
  'https://meet.example.test/session/secret',
  'Registered learners can request their live class meeting reference'
);
select ok(
  public.storage_can_access_lesson(
    '00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000601/preview.mp4',
    'lesson-media'
  ),
  'Enrolled learners can access authorized lesson media'
);
select ok(
  public.storage_can_access_lesson(
    '00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000602/notes.pdf',
    'learning-resources'
  ),
  'Learning resource access is bound to an enrolled lesson'
);
select ok(
  not public.storage_can_manage_course(
    '00000000-0000-4000-8000-000000000301/thumbnail.webp'
  ),
  'Students cannot upload or manage course thumbnails'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'lesson-media'
  ),
  1,
  'Enrolled learners can read authorized lesson media objects'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'learning-resources'
  ),
  1,
  'Enrolled learners can read authorized resource objects'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'user-avatars'
  ),
  1,
  'Users can read only their own private avatar objects'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'certificates'
  ),
  1,
  'Certificate owners can read their private certificate objects'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000202","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000202',
  true
);
select is(
  (select count(*)::integer from public.lesson_progress),
  0,
  'Progress records are isolated between students'
);
select is(
  (select count(*)::integer from public.payments),
  1,
  'A second student sees only their own payment'
);
select throws_ok(
  $$
    select public.get_live_class_meeting_reference(
      '00000000-0000-4000-8000-000000001601'
    )
  $$,
  '42501',
  null,
  'Unregistered learners cannot retrieve private meeting credentials'
);
select ok(
  not public.storage_can_access_lesson(
    '00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000602/notes.pdf',
    'learning-resources'
  ),
  'Unenrolled learners cannot access private learning resources'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'lesson-media'
  ),
  1,
  'Unenrolled learners can read only explicitly published preview media'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'learning-resources'
  ),
  0,
  'Unenrolled learners cannot read private resource objects'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'user-avatars'
  ),
  0,
  'Users cannot read another learner avatar object'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'certificates'
  ),
  0,
  'Users cannot read another learner certificate object'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000203","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000203',
  true
);
select is(
  (select count(*)::integer from public.enrollments),
  2,
  'Instructors can read enrollment records for their own courses'
);
select is(
  (
    select count(*)::integer
    from public.get_course_student_roster('00000000-0000-4000-8000-000000000301')
  ),
  2,
  'Instructors can read a limited roster for their own courses'
);
select ok(
  (
    select correct_option_ids @> array['00000000-0000-4000-8000-000000000911'::uuid]
    from public.get_quiz_answer_key('00000000-0000-4000-8000-000000000901')
    where question_id = '00000000-0000-4000-8000-000000000801'
  ),
  'Instructors can access answer keys for their own assessments'
);
select lives_ok(
  $$
    select public.grade_quiz_answer(
      answer.id,
      0.75
    )
    from public.quiz_answers as answer
    where answer.attempt_id = current_setting('test.quiz_attempt_id')::uuid
      and answer.question_id = '00000000-0000-4000-8000-000000000802'
  $$,
  'Instructors can grade manual answers for their own courses'
);
select is(
  (
    select status
    from public.quiz_attempts
    where id = current_setting('test.quiz_attempt_id')::uuid
  ),
  'GRADED',
  'Attempts are finalized after all manual answers are graded'
);
select is(
  (
    select score
    from public.quiz_attempts
    where id = current_setting('test.quiz_attempt_id')::uuid
  ),
  2.25::numeric,
  'Manual grading updates the trusted attempt score'
);
select throws_ok(
  $$
    update public.quiz_questions
    set question_text = 'Changed after an attempt'
    where id = '00000000-0000-4000-8000-000000000801'
  $$,
  '23514',
  null,
  'Question content cannot change after attempts have started'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000201',
  true
);
select set_config(
  'test.expired_attempt_id',
  public.start_quiz_attempt('00000000-0000-4000-8000-000000000901')::text,
  true
);
reset role;
update public.quiz_attempts
set expires_at = now() - interval '1 second'
where id = current_setting('test.expired_attempt_id')::uuid;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000201',
  true
);
select lives_ok(
  $$
    select *
    from public.submit_quiz_attempt(current_setting('test.expired_attempt_id')::uuid)
  $$,
  'Expired attempts finalize saved work instead of remaining active'
);
select is(
  (
    select is_expired
    from public.quiz_attempts
    where id = current_setting('test.expired_attempt_id')::uuid
  ),
  true,
  'Expired submission state is recorded'
);
select lives_ok(
  $$
    select *
    from public.submit_quiz_attempt(current_setting('test.expired_attempt_id')::uuid)
  $$,
  'Submitting an already finalized attempt is idempotent'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000203","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000203',
  true
);
select is(
  (select count(*)::integer from public.payments),
  0,
  'Instructors cannot read payment records'
);
select ok(
  public.storage_can_manage_course(
    '00000000-0000-4000-8000-000000000301/thumbnail.webp'
  ),
  'Course instructors can manage storage for their own courses'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'lesson-media'
  ),
  1,
  'Course instructors can read their course media objects'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'user-avatars'
  ),
  0,
  'Course instructors cannot read private learner avatars'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000204","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000204',
  true
);
select is(
  (select count(*)::integer from public.payments),
  2,
  'Administrators can read platform payment records'
);
select ok(
  not has_table_privilege('authenticated', 'public.payment_events', 'SELECT'),
  'Payment event records are not directly readable by client roles'
);
select lives_ok(
  $$
    update public.platform_settings
    set setting_value = '"LingoPro Academy"'::jsonb
    where setting_key = 'public.site_name'
  $$,
  'Administrators can manage public platform settings'
);
select is(
  (
    select setting_value
    from public.platform_settings
    where setting_key = 'public.site_name'
  ),
  '"LingoPro Academy"'::jsonb,
  'Administrator settings updates are persisted'
);
select lives_ok(
  $$
    update public.courses
    set status = 'PUBLISHED', published_at = now()
    where id = '00000000-0000-4000-8000-000000000302'
  $$,
  'Administrators can publish reviewed courses'
);
select is(
  (
    select status
    from public.courses
    where id = '00000000-0000-4000-8000-000000000302'
  ),
  'PUBLISHED',
  'Course publishing state is persisted'
);
select ok(
  not has_table_privilege('authenticated', 'public.payments', 'UPDATE'),
  'Authenticated users cannot change payment status directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.certificates', 'INSERT'),
  'Certificates cannot be created through direct client inserts'
);

reset role;

select is(
  (
    select count(*)::integer
    from storage.buckets
    where id in (
      'lesson-media',
      'learning-resources',
      'user-avatars',
      'certificates'
    )
      and not public
  ),
  4,
  'Protected Storage buckets are private'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'user-avatars'
  ),
  1,
  'Administrators can read platform avatar objects'
);
select ok(
  (
    select public
    from storage.buckets
    where id = 'course-thumbnails'
  ),
  'Only non-sensitive course thumbnails use a public Storage bucket'
);

select * from finish();
rollback;
