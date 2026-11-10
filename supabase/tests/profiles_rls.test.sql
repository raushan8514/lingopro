begin;

select plan(12);

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
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase4-student@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Student","role":"admin"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase4-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Instructor"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase4-admin@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Admin"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000000102';

update public.profiles
set role = 'admin'
where id = '00000000-0000-4000-8000-000000000103';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select role from public.profiles where id = '00000000-0000-4000-8000-000000000101'),
  'student',
  'Registration metadata cannot elevate the default student role'
);
select is(
  (select count(*)::integer from public.profiles),
  1,
  'Students can only read their own profile'
);
select lives_ok(
  $$update public.profiles set full_name = 'Updated Student' where id = '00000000-0000-4000-8000-000000000101'$$,
  'Students can update permitted profile fields'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000101'$$,
  '42501',
  null,
  'Students cannot update their role column'
);
select throws_ok(
  $$select public.admin_set_user_role('00000000-0000-4000-8000-000000000101', 'admin')$$,
  '42501',
  null,
  'Students cannot call the administrative role function'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select is(
  (select count(*)::integer from public.profiles),
  1,
  'Instructors can only read their own profile'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select is(
  (select count(*)::integer from public.profiles),
  3,
  'Administrators can read profiles for role management'
);
select lives_ok(
  $$select public.admin_set_user_role('00000000-0000-4000-8000-000000000101', 'instructor')$$,
  'Administrators can approve an instructor account'
);
select is(
  (select role from public.profiles where id = '00000000-0000-4000-8000-000000000101'),
  'instructor',
  'Authorized role changes are persisted'
);
select throws_ok(
  $$select public.admin_set_user_role('00000000-0000-4000-8000-000000000103', 'student')$$,
  '23514',
  null,
  'Administrators cannot demote their own account'
);
select throws_ok(
  $$select public.admin_set_user_role('00000000-0000-4000-8000-000000000101', 'owner')$$,
  '23514',
  null,
  'Administrators cannot assign an unsupported role'
);

select ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'Anonymous users have no profile table read privilege'
);

select * from finish();
rollback;
