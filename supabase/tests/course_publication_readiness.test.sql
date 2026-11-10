begin;

select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  '00000000-0000-4000-8000-000000006001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'course-readiness-admin@example.test',
  crypt('temporary-test-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Readiness Admin"}',
  now(), now()
);

update public.profiles
set role = 'admin'
where id = '00000000-0000-4000-8000-000000006001';

insert into public.courses (
  id, instructor_id, title, slug, language, difficulty, status
)
values (
  '00000000-0000-4000-8000-000000006002',
  '00000000-0000-4000-8000-000000006001',
  'Readiness course', 'readiness-course', 'French', 'BEGINNER', 'DRAFT'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000006001","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000006001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.admin_moderate_course(
    '00000000-0000-4000-8000-000000006002',
    'publish',
    'Course review passed'
  )$$,
  '23514',
  null,
  'A course without curriculum cannot be published'
);

reset role;
insert into public.course_sections (id, course_id, title, position)
values (
  '00000000-0000-4000-8000-000000006003',
  '00000000-0000-4000-8000-000000006002',
  'First module', 0
);
insert into public.lessons (
  id, section_id, title, content_type, content, position, is_published
)
values (
  '00000000-0000-4000-8000-000000006004',
  '00000000-0000-4000-8000-000000006003',
  'Unpublished reading', 'TEXT', '{}', 0, false
);

set local role authenticated;
select throws_ok(
  $$select public.admin_moderate_course(
    '00000000-0000-4000-8000-000000006002',
    'publish',
    'Course review passed'
  )$$,
  '23514',
  null,
  'A module without a published lesson cannot be published'
);

reset role;
update public.lessons
set is_published = true
where id = '00000000-0000-4000-8000-000000006004';

set local role authenticated;
select throws_ok(
  $$select public.admin_moderate_course(
    '00000000-0000-4000-8000-000000006002',
    'publish',
    'Course review passed'
  )$$,
  '23514',
  null,
  'A published text lesson without reading content cannot be published'
);

reset role;
update public.lessons
set content = '{"body":"Read and practice these phrases."}'
where id = '00000000-0000-4000-8000-000000006004';

set local role authenticated;
select lives_ok(
  $$select public.admin_moderate_course(
    '00000000-0000-4000-8000-000000006002',
    'publish',
    'Course review passed'
  )$$,
  'An administrator can publish a course with valid published lessons'
);
select is(
  (select status from public.courses
   where id = '00000000-0000-4000-8000-000000006002'),
  'PUBLISHED',
  'The approved course becomes public only after readiness validation'
);
select throws_ok(
  $$update public.courses
    set learning_outcomes = array['   ']
    where id = '00000000-0000-4000-8000-000000006002'$$,
  '23514',
  null,
  'Learning outcomes cannot contain blank entries'
);

reset role;
rollback;
