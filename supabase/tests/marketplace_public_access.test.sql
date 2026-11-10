begin;

select plan(31);

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
    '00000000-0000-4000-8000-000000002001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'marketplace-student@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Marketplace Learner"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000002002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'marketplace-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Marketplace Instructor"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000002003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'other-marketplace-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Other Instructor"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor', avatar_url = 'https://images.example.test/instructor.webp'
where id = '00000000-0000-4000-8000-000000002002';

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000002003';

insert into public.course_categories (id, name, slug, is_active)
values
  ('00000000-0000-4000-8000-000000002101', 'Conversation Practice', 'conversation-practice', true),
  ('00000000-0000-4000-8000-000000002102', 'Hidden Topic', 'hidden-topic', false);

insert into public.courses (
  id,
  instructor_id,
  category_id,
  title,
  slug,
  short_description,
  description,
  language,
  difficulty,
  price_cents,
  status,
  published_at
)
values
  (
    '00000000-0000-4000-8000-000000002201',
    '00000000-0000-4000-8000-000000002002',
    '00000000-0000-4000-8000-000000002101',
    'Spanish for travel',
    'spanish-for-travel',
    'Useful phrases for your next trip',
    'Practice conversation before your journey.',
    'Spanish',
    'BEGINNER',
    0,
    'DRAFT',
    null
  ),
  (
    '00000000-0000-4000-8000-000000002202',
    '00000000-0000-4000-8000-000000002002',
    '00000000-0000-4000-8000-000000002102',
    'French writing workshop',
    'french-writing-workshop',
    'Build confidence with written French',
    'A published advanced course.',
    'French',
    'ADVANCED',
    2500,
    'DRAFT',
    null
  ),
  (
    '00000000-0000-4000-8000-000000002203',
    '00000000-0000-4000-8000-000000002002',
    '00000000-0000-4000-8000-000000002101',
    'Unpublished Spanish course',
    'unpublished-spanish-course',
    'This must not appear publicly',
    'Draft content.',
    'Spanish',
    'BEGINNER',
    0,
    'DRAFT',
    null
  ),
  (
    '00000000-0000-4000-8000-000000002204',
    '00000000-0000-4000-8000-000000002003',
    '00000000-0000-4000-8000-000000002101',
    'Another instructor draft',
    'another-instructor-draft',
    'Not public',
    'Draft content.',
    'Spanish',
    'BEGINNER',
    0,
    'DRAFT',
    null
  );

insert into public.course_sections (id, course_id, title, description, position)
values
  (
    '00000000-0000-4000-8000-000000002301',
    '00000000-0000-4000-8000-000000002201',
    'Getting started',
    'Public section summary',
    0
  ),
  (
    '00000000-0000-4000-8000-000000002302',
    '00000000-0000-4000-8000-000000002202',
    'Writing basics',
    'Published advanced material',
    0
  );

insert into public.lessons (
  id,
  section_id,
  title,
  description,
  content_type,
  content,
  duration_seconds,
  position,
  is_preview,
  is_published
)
values
  (
    '00000000-0000-4000-8000-000000002401',
    '00000000-0000-4000-8000-000000002301',
    'First travel phrases',
    'Private lesson description',
    'TEXT',
    '{"body":"Private lesson content must not appear in the public curriculum"}',
    300,
    0,
    true,
    true
  ),
  (
    '00000000-0000-4000-8000-000000002402',
    '00000000-0000-4000-8000-000000002301',
    'Ordering at a café',
    'Private lesson description',
    'TEXT',
    '{"body":"Private lesson content"}',
    420,
    1,
    false,
    true
  ),
  (
    '00000000-0000-4000-8000-000000002403',
    '00000000-0000-4000-8000-000000002301',
    'Unpublished vocabulary',
    'Not public',
    'TEXT',
    '{"body":"Unpublished"}',
    180,
    2,
    false,
    false
  ),
  (
    '00000000-0000-4000-8000-000000002404',
    '00000000-0000-4000-8000-000000002302',
    'First writing exercise',
    'Practice writing with a real reading prompt.',
    'TEXT',
    '{"body":"Write a short introduction in French."}',
    300,
    0,
    false,
    true
  );

update public.courses
set status = 'PUBLISHED', published_at = now()
where id in (
  '00000000-0000-4000-8000-000000002201',
  '00000000-0000-4000-8000-000000002202'
);

select is(
  (public.search_published_courses()->>'total')::integer,
  2,
  'Public search counts only published courses'
);
select is(
  jsonb_array_length(public.search_published_courses()->'courses'),
  2,
  'Public search returns paginated published course data'
);
select is(
  (public.search_published_courses(p_search_term => 'conversation')->>'total')::integer,
  1,
  'Search matches a published course category'
);
select is(
  (public.search_published_courses(p_language => 'Spanish')->>'total')::integer,
  1,
  'Language filtering uses actual published course data'
);
select is(
  (public.search_published_courses(p_price => 'paid')->>'total')::integer,
  1,
  'Paid filtering uses the stored course price'
);
select is(
  jsonb_array_length(
    public.search_published_courses(
      p_limit => 1,
      p_offset => 1
    )->'courses'
  ),
  1,
  'Pagination returns only the requested page size'
);
select is(
  public.search_published_courses(
    p_sort => 'alphabetical'
  )->'courses'->0->>'title',
  'French writing workshop',
  'Alphabetical sorting uses course titles'
);
select is(
  public.search_published_courses(
    p_sort => 'price-asc'
  )->'courses'->0->>'slug',
  'spanish-for-travel',
  'Price sorting uses stored integer prices'
);
select is(
  jsonb_array_length(public.search_published_courses()->'languages'),
  2,
  'Language filter options come from published course data'
);
select is(
  (public.search_published_courses(
    p_category_id => '00000000-0000-4000-8000-000000002102'
  )->>'total')::integer,
  0,
  'Inactive categories do not produce public filtered results'
);
select throws_ok(
  $$select public.search_published_courses(p_sort => 'random')$$,
  '22023',
  null,
  'Invalid sort inputs are rejected by the database'
);
select throws_ok(
  $$select public.search_published_courses(p_limit => 1000)$$,
  '22023',
  null,
  'Oversized page requests are rejected by the database'
);
select is(
  (
    public.search_published_courses(
      p_difficulty => 'BEGINNER',
      p_price => 'free',
      p_category_id => '00000000-0000-4000-8000-000000002101'
    )->>'total'
  )::integer,
  1,
  'Combined filters are applied to the same published result set'
);
select is(
  public.get_public_course_details('unpublished-spanish-course'),
  null::jsonb,
  'Unpublished courses are unavailable through the public detail function'
);
select ok(
  not (
    public.get_public_course_details('spanish-for-travel')
    ? 'email'
  ),
  'Public course details exclude instructor email addresses'
);
select is(
  (
    select count(*)::integer
    from public.get_public_course_categories()
  ),
  1,
  'Only active categories containing published courses are public'
);
select is(
  (
    select full_name
    from public.get_public_instructor_profile(
      '00000000-0000-4000-8000-000000002002'
    )
  ),
  'Marketplace Instructor',
  'Instructor public profile returns the permitted display name'
);
select ok(
  not (
    to_jsonb((
      select profile
      from public.get_public_instructor_profile(
        '00000000-0000-4000-8000-000000002002'
      ) as profile
    )) ? 'email'
  ),
  'Instructor public profile excludes private email information'
);
select is(
  jsonb_array_length(
    public.get_public_course_curriculum(
      '00000000-0000-4000-8000-000000002201'
    )->0->'lessons'
  ),
  2,
  'Public curriculum includes published lesson metadata only'
);
select ok(
  not (
    public.get_public_course_curriculum(
      '00000000-0000-4000-8000-000000002201'
    )::text like '%Private lesson content%'
  ),
  'Public curriculum does not expose lesson content or descriptions'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.course_sections$$,
  '42501',
  null,
  'Anonymous users cannot read course sections directly'
);
select throws_ok(
  $$
    insert into public.enrollments (
      student_id,
      course_id,
      status,
      enrollment_type
    )
    values (
      '00000000-0000-4000-8000-000000002001',
      '00000000-0000-4000-8000-000000002201',
      'ACTIVE',
      'FREE'
    )
  $$,
  '42501',
  null,
  'Anonymous visitors cannot enroll'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000002001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002001',
  true
);
select lives_ok(
  $$
    insert into public.enrollments (
      student_id,
      course_id,
      status,
      enrollment_type
    )
    values (
      '00000000-0000-4000-8000-000000002001',
      '00000000-0000-4000-8000-000000002201',
      'ACTIVE',
      'FREE'
    )
  $$,
  'Students can enroll in published free courses through RLS'
);
select throws_ok(
  $$
    insert into public.enrollments (
      student_id,
      course_id,
      status,
      enrollment_type
    )
    values (
      '00000000-0000-4000-8000-000000002001',
      '00000000-0000-4000-8000-000000002201',
      'ACTIVE',
      'FREE'
    )
  $$,
  '23505',
  null,
  'Duplicate active enrollments are rejected'
);
select throws_ok(
  $$
    insert into public.enrollments (
      student_id,
      course_id,
      status,
      enrollment_type
    )
    values (
      '00000000-0000-4000-8000-000000002001',
      '00000000-0000-4000-8000-000000002202',
      'ACTIVE',
      'PAID'
    )
  $$,
  '42501',
  null,
  'Students cannot create paid enrollments without trusted payment processing'
);
select throws_ok(
  $$
    insert into public.enrollments (
      student_id,
      course_id,
      status,
      enrollment_type
    )
    values (
      '00000000-0000-4000-8000-000000002001',
      '00000000-0000-4000-8000-000000002203',
      'ACTIVE',
      'FREE'
    )
  $$,
  '42501',
  null,
  'Students cannot enroll in unpublished courses'
);
select lives_ok(
  $$
    update public.courses
    set title = 'Unauthorized course edit'
    where id = '00000000-0000-4000-8000-000000002201'
  $$,
  'Student course edit attempt is safely rejected by RLS'
);
select is(
  (select title from public.courses where id = '00000000-0000-4000-8000-000000002201'),
  'Spanish for travel',
  'Students cannot modify published course content'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000002002","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002002',
  true
);
select is(
  auth.uid(),
  '00000000-0000-4000-8000-000000002002'::uuid,
  'Instructor authorization uses the active user identity'
);
select lives_ok(
  $$
    update public.courses
    set title = 'Unauthorized instructor edit'
    where id = '00000000-0000-4000-8000-000000002204'
  $$,
  'Cross-instructor edit attempt is safely rejected by RLS'
);
reset role;
select is(
  (select title from public.courses where id = '00000000-0000-4000-8000-000000002204'),
  'Another instructor draft',
  'Instructors cannot modify another instructor course'
);

select * from finish();
rollback;
