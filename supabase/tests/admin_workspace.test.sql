begin;

select plan(28);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin-phase11-student@example.test',
    crypt('temporary-test-password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase 11 Student","role":"admin"}', now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000112',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin-phase11-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase 11 Instructor"}', now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000113',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin-phase11-admin@example.test',
    crypt('temporary-test-password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase 11 Admin"}', now(), now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000000112';

update public.profiles
set role = 'admin'
where id = '00000000-0000-4000-8000-000000000113';

insert into public.course_categories (id, name, slug, description)
values (
  '00000000-0000-4000-8000-000000000114',
  'Phase Eleven Category',
  'phase-eleven-category',
  'Transaction-scoped admin test category'
);

insert into public.courses (
  id, instructor_id, category_id, title, slug, language, difficulty, status
)
values (
  '00000000-0000-4000-8000-000000000115',
  '00000000-0000-4000-8000-000000000112',
  '00000000-0000-4000-8000-000000000114',
  'Phase Eleven Course',
  'phase-eleven-course',
  'French',
  'BEGINNER',
  'PENDING_REVIEW'
);

insert into public.course_sections (id, course_id, title, position)
values (
  '00000000-0000-4000-8000-000000000118',
  '00000000-0000-4000-8000-000000000115',
  'Course content',
  0
);

insert into public.lessons (
  id, section_id, title, content_type, content, position, is_published
)
values (
  '00000000-0000-4000-8000-000000000119',
  '00000000-0000-4000-8000-000000000118',
  'Introduction',
  'TEXT',
  '{"body":"A complete published lesson for moderation."}',
  0,
  true
);

insert into public.quizzes (id, course_id, title, is_published)
values (
  '00000000-0000-4000-8000-000000000116',
  '00000000-0000-4000-8000-000000000115',
  'Phase Eleven Assessment',
  false
);

insert into public.quiz_questions (
  id, quiz_id, question_text, question_type, points, position
)
values (
  '00000000-0000-4000-8000-000000000117',
  '00000000-0000-4000-8000-000000000116',
  'Test question',
  'SINGLE_CHOICE',
  1,
  0
);

insert into public.question_options (question_id, option_text, position, is_correct)
values
  ('00000000-0000-4000-8000-000000000117', 'Correct option', 0, true),
  ('00000000-0000-4000-8000-000000000117', 'Other option', 1, false);

update public.quizzes
set is_published = true
where id = '00000000-0000-4000-8000-000000000116';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000111","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select role from public.profiles where id = '00000000-0000-4000-8000-000000000111'),
  'student',
  'Public registration metadata cannot grant administrator privileges'
);
select throws_ok(
  $$select public.admin_get_dashboard_data()$$,
  '42501',
  null,
  'Students cannot call the administrative overview'
);
select throws_ok(
  $$select * from public.admin_list_profiles('', '', 10, 0)$$,
  '42501',
  null,
  'Students cannot list platform profiles'
);
select throws_ok(
  $$select public.admin_moderate_course('00000000-0000-4000-8000-000000000115', 'publish', 'not allowed')$$,
  '42501',
  null,
  'Students cannot moderate courses'
);
select throws_ok(
  $$insert into public.platform_settings (setting_key, setting_value) values ('platform.test', 'true'::jsonb)$$,
  '42501',
  null,
  'Students cannot modify platform settings'
);
select is(
  (select count(*)::integer from public.admin_audit_logs),
  0,
  'Students cannot read the administrator audit log'
);
select ok(
  not has_table_privilege('authenticated', 'public.admin_audit_logs', 'INSERT'),
  'Authenticated application users cannot insert audit rows'
);
select ok(
  not has_table_privilege('authenticated', 'public.admin_audit_logs', 'UPDATE'),
  'Authenticated application users cannot update audit rows'
);
select ok(
  not has_table_privilege('authenticated', 'public.admin_audit_logs', 'DELETE'),
  'Authenticated application users cannot delete audit rows'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000113","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000113', true);

select is(
  (public.admin_get_dashboard_data() -> 'courses' ->> 'pending_review')::integer,
  1,
  'Administrator overview returns the real pending course count'
);
select is(
  (select total_count::integer from public.admin_list_profiles('Phase 11 Instructor', '', 10, 0) limit 1),
  1,
  'Administrator user search matches profile name'
);
select is(
  (select total_count::integer from public.admin_list_courses('Phase Eleven', 'PENDING_REVIEW', '00000000-0000-4000-8000-000000000114', 'BEGINNER', 'French', 10, 0) limit 1),
  1,
  'Administrator course search applies status, category, difficulty, language, and text filters'
);
select is(
  (select total_count::integer from public.admin_list_assessments('Phase Eleven', 'published', 10, 0) limit 1),
  1,
  'Assessment listing exposes filtered assessment metadata'
);
select is(
  (public.admin_get_assessment_stats('00000000-0000-4000-8000-000000000116') ->> 'attempts')::integer,
  0,
  'Assessment statistics aggregate real attempts without returning answer data'
);
select lives_ok(
  $$select public.admin_moderate_course('00000000-0000-4000-8000-000000000115', 'publish', 'Course review passed')$$,
  'Administrators can publish an eligible course with a reason'
);
select is(
  (select status from public.courses where id = '00000000-0000-4000-8000-000000000115'),
  'PUBLISHED',
  'Course moderation preserves the course and updates publication status'
);
select is(
  (select reason from public.admin_audit_logs where entity_id = '00000000-0000-4000-8000-000000000115' order by created_at desc limit 1),
  'Course review passed',
  'Course moderation reason is included in the audit record'
);
select lives_ok(
  $$select public.admin_unpublish_assessment('00000000-0000-4000-8000-000000000116', 'Content needs review')$$,
  'Administrators can unpublish an assessment with a reason'
);
select is(
  (select is_published from public.quizzes where id = '00000000-0000-4000-8000-000000000116'),
  false,
  'Assessment moderation changes publication state only'
);
select lives_ok(
  $$select public.admin_set_user_role('00000000-0000-4000-8000-000000000111', 'instructor')$$,
  'Administrators can change a user role through the trusted operation'
);
select is(
  (select role from public.profiles where id = '00000000-0000-4000-8000-000000000111'),
  'instructor',
  'Role changes are persisted by the trusted operation'
);
select ok(
  (select count(*) > 0 from public.admin_audit_logs where action = 'user.role_changed' and entity_id = '00000000-0000-4000-8000-000000000111'),
  'Role changes are recorded in the audit log'
);
select throws_ok(
  $$select public.admin_set_user_role('00000000-0000-4000-8000-000000000113', 'student')$$,
  '23514',
  null,
  'Administrators cannot change their own role'
);
select lives_ok(
  $$update public.course_categories set is_active = false where id = '00000000-0000-4000-8000-000000000114'$$,
  'Administrators can deactivate a category without deleting it'
);
select ok(
  (select count(*) > 0 from public.admin_audit_logs where action = 'category.updated' and entity_id = '00000000-0000-4000-8000-000000000114'),
  'Category changes are recorded in the audit log'
);
select lives_ok(
  $$insert into public.platform_settings (setting_key, setting_value, updated_by) values ('platform.test', '"safe value"'::jsonb, '00000000-0000-4000-8000-000000000113')$$,
  'Administrators can store a non-secret platform setting'
);
select ok(
  (select count(*) > 0 from public.admin_audit_logs where action = 'setting.created' and metadata ->> 'setting_key' = 'platform.test' and not (metadata ? 'setting_value')),
  'Setting audit entries record the setting key but never its value'
);
reset role;
select is(
  (select count(*)::integer from public.notifications where user_id in ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000112')),
  3,
  'Role and moderation decisions send in-app notices to affected accounts'
);

select * from finish();
rollback;
