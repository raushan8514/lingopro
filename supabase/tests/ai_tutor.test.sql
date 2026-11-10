begin;

select plan(23);

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
    '00000000-0000-4000-8000-000000009101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ai-tutor-student-one@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"AI Tutor Student One"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000009102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ai-tutor-student-two@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"AI Tutor Student Two"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000009103',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ai-tutor-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"AI Tutor Instructor"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000009103';

select ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_tutor_conversations'::regclass),
  'Conversation RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_tutor_messages'::regclass),
  'Message RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.student_saved_vocabulary'::regclass),
  'Saved vocabulary RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_tutor_daily_usage'::regclass),
  'Usage counters are not directly readable'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009101","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$insert into public.ai_tutor_conversations (
    id, student_id, title, mode, language, level
  ) values (
    '00000000-0000-4000-8000-000000009201',
    '00000000-0000-4000-8000-000000009101',
    'Spanish practice',
    'conversation',
    'Spanish',
    'A2'
  )$$,
  'A student can create their own conversation'
);
select lives_ok(
  $$insert into public.ai_tutor_messages (
    id, conversation_id, student_id, role, content
  ) values (
    '00000000-0000-4000-8000-000000009301',
    '00000000-0000-4000-8000-000000009201',
    '00000000-0000-4000-8000-000000009101',
    'user',
    'Hola'
  )$$,
  'A student can add a message to their conversation'
);
select lives_ok(
  $$insert into public.student_saved_vocabulary (
    id, student_id, source_conversation_id, word, meaning, language
  ) values (
    '00000000-0000-4000-8000-000000009401',
    '00000000-0000-4000-8000-000000009101',
    '00000000-0000-4000-8000-000000009201',
    'hola',
    'hello',
    'Spanish'
  )$$,
  'A student can save vocabulary from their own conversation'
);
select is(
  (select count(*)::integer from public.ai_tutor_conversations),
  1,
  'A student can read their own conversation'
);
select is(
  (select count(*)::integer from public.ai_tutor_messages),
  1,
  'A student can read their own message'
);
select is(
  (select count(*)::integer from public.student_saved_vocabulary),
  1,
  'A student can read their own saved vocabulary'
);
select is(
  public.consume_student_ai_tutor_quota(),
  true,
  'The first daily tutor request is allowed'
);
select is(
  (
    select count(*)::integer
    from generate_series(1, 20)
    where public.consume_student_ai_tutor_quota()
  ),
  19,
  'The atomic daily quota allows no more than 20 tutor requests'
);
select is(
  public.consume_student_ai_tutor_quota(),
  false,
  'The tutor quota rejects further requests that day'
);
select throws_ok(
  $$select * from public.ai_tutor_daily_usage$$,
  '42501',
  null,
  'Students cannot directly read AI tutor quota counters'
);
select throws_ok(
  $$insert into public.ai_tutor_daily_usage (student_id, usage_date, request_count)
  values ('00000000-0000-4000-8000-000000009101', current_date, 1)$$,
  '42501',
  null,
  'Students cannot directly write AI tutor quota counters'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009102","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009102', true);
select is(
  (select count(*)::integer from public.ai_tutor_conversations),
  0,
  'A different student cannot read the first student conversations'
);
select is(
  (select count(*)::integer from public.ai_tutor_messages),
  0,
  'A different student cannot read the first student messages'
);
select is(
  (select count(*)::integer from public.student_saved_vocabulary),
  0,
  'A different student cannot read the first student vocabulary'
);
select throws_ok(
  $$insert into public.ai_tutor_messages (
    conversation_id, student_id, role, content
  ) values (
    '00000000-0000-4000-8000-000000009201',
    '00000000-0000-4000-8000-000000009102',
    'user',
    'Should not be attached to another student'
  )$$,
  '42501',
  null,
  'A student cannot write to someone else’s conversation'
);
select throws_ok(
  $$insert into public.ai_tutor_conversations (
    student_id, title, mode, language, level
  ) values (
    '00000000-0000-4000-8000-000000009101',
    'Forged owner',
    'conversation',
    'Spanish',
    'A2'
  )$$,
  '42501',
  null,
  'A student cannot create a conversation for another account'
);
select throws_ok(
  $$insert into public.student_saved_vocabulary (
    student_id, source_conversation_id, word, meaning, language
  ) values (
    '00000000-0000-4000-8000-000000009102',
    '00000000-0000-4000-8000-000000009201',
    'word',
    'meaning',
    'Spanish'
  )$$,
  '42501',
  null,
  'A student cannot associate saved vocabulary with another student conversation'
);
delete from public.ai_tutor_conversations
where id = '00000000-0000-4000-8000-000000009201';
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009101","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009101', true);
select is(
  (select count(*)::integer from public.ai_tutor_conversations),
  1,
  'Cross-student conversation deletion does not affect the owner record'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009103","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009103', true);
select throws_ok(
  $$select public.consume_student_ai_tutor_quota()$$,
  '42501',
  null,
  'Non-student roles cannot consume AI tutor quota'
);

select * from finish();
rollback;
