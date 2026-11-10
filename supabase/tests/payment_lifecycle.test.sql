begin;

select plan(37);

select is(
  (
    select column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscription_plans'
      and column_name = 'is_active'
  ),
  'false',
  'New subscription plans are inactive until explicitly activated'
);

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
    '00000000-0000-4000-8000-000000001201',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase12-student@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase Twelve Student"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000001202',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase12-instructor@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase Twelve Instructor"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000001203',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase12-admin@example.test',
    crypt('temporary-test-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Phase Twelve Admin"}',
    now(),
    now()
  );

update public.profiles
set role = 'instructor'
where id = '00000000-0000-4000-8000-000000001202';

update public.profiles
set role = 'admin'
where id = '00000000-0000-4000-8000-000000001203';

insert into public.courses (
  id,
  instructor_id,
  title,
  slug,
  language,
  difficulty,
  price_cents,
  currency,
  status,
  published_at
)
values (
  '00000000-0000-4000-8000-000000001301',
  '00000000-0000-4000-8000-000000001202',
  'Paid Test Course',
  'phase12-paid-test-course',
  'French',
  'BEGINNER',
  5500,
  'INR',
  'DRAFT',
  null
);

insert into public.course_sections (id, course_id, title, position)
values (
  '00000000-0000-4000-8000-000000001311',
  '00000000-0000-4000-8000-000000001301',
  'Course content',
  0
);

insert into public.lessons (
  id, section_id, title, description, content_type, position, is_published
)
values (
  '00000000-0000-4000-8000-000000001312',
  '00000000-0000-4000-8000-000000001311',
  'French introduction',
  'A short introduction to French.',
  'TEXT',
  0,
  true
);

update public.courses
set status = 'PUBLISHED', published_at = now()
where id = '00000000-0000-4000-8000-000000001301';

insert into public.subscription_plans (
  id,
  name,
  slug,
  description,
  price_cents,
  currency,
  billing_interval,
  interval_count,
  billing_cycles,
  is_active
)
values (
  '00000000-0000-4000-8000-000000001401',
  'Finite Test Plan',
  'phase12-finite-test-plan',
  'Test-only plan',
  1800,
  'INR',
  'MONTH',
  1,
  6,
  true
),
(
  '00000000-0000-4000-8000-000000001402',
  'Second Test Plan',
  'phase12-second-test-plan',
  'Test-only alternate plan',
  2500,
  'INR',
  'MONTH',
  1,
  6,
  true
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_pending_course_payment(uuid,uuid)',
    'EXECUTE'
  ),
  'Students can request a pending course payment'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_pending_course_payment(uuid,uuid)',
    'EXECUTE'
  ),
  'Anonymous users cannot request a course payment'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.attach_razorpay_order(uuid,text)',
    'EXECUTE'
  ),
  'Students cannot attach provider orders'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_razorpay_course_payment(uuid,text,text,integer,text,text)',
    'EXECUTE'
  ),
  'Students cannot finalize course payments'
);
select ok(
  not has_table_privilege('authenticated', 'public.payments', 'INSERT'),
  'Students cannot insert payment records directly'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000001201","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001201', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$select * from public.create_pending_course_payment(
    '00000000-0000-4000-8000-000000001301',
    '00000000-0000-4000-8000-000000001501'
  )$$,
  'Student checkout creates a pending payment from the stored course price'
);

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);

select lives_ok(
  $$select public.attach_razorpay_order(
    (select id from public.payments
      where student_id = '00000000-0000-4000-8000-000000001201'
        and course_id = '00000000-0000-4000-8000-000000001301'),
    'order_LPTestCourse0001'
  )$$,
  'Trusted processing links the provider order'
);
select throws_ok(
  $$select public.process_razorpay_webhook(
    'evt_LPTestCourseCaptured001',
    'payment.captured',
    jsonb_build_object(
      'created_at', extract(epoch from now())::bigint,
      'payload', jsonb_build_object(
        'payment', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'pay_LPTestCourse0001',
            'order_id', 'order_LPTestCourse0001',
            'amount', 5501,
            'currency', 'INR',
            'status', 'captured'
          )
        )
      )
    )
  )$$,
  '23514',
  null,
  'A webhook amount mismatch is rejected'
);
select lives_ok(
  $$select public.process_razorpay_webhook(
    'evt_LPTestCourseCaptured001',
    'payment.captured',
    jsonb_build_object(
      'created_at', extract(epoch from now())::bigint,
      'payload', jsonb_build_object(
        'payment', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'pay_LPTestCourse0001',
            'order_id', 'order_LPTestCourse0001',
            'amount', 5500,
            'currency', 'INR',
            'status', 'captured',
            'method', 'upi'
          )
        )
      )
    )
  )$$,
  'A verified capture webhook finalizes the course payment'
);
select is(
  (select status from public.payments
    where provider_payment_id = 'pay_LPTestCourse0001'),
  'SUCCEEDED',
  'Captured course payment is recorded as successful'
);
select is(
  (select count(*)::integer from public.enrollments
    where student_id = '00000000-0000-4000-8000-000000001201'
      and course_id = '00000000-0000-4000-8000-000000001301'),
  1,
  'Captured payment creates exactly one enrollment'
);
select is(
  (select enrollment_type from public.enrollments
    where student_id = '00000000-0000-4000-8000-000000001201'
      and course_id = '00000000-0000-4000-8000-000000001301'),
  'PAID',
  'Verified paid course is distinguished from free enrollment'
);
select is(
  public.process_razorpay_webhook(
    'evt_LPTestCourseCaptured001',
    'payment.captured',
    '{}'::jsonb
  )->>'duplicate',
  'true',
  'A repeated provider event is acknowledged as a duplicate'
);
select is(
  (select count(*)::integer from public.enrollments
    where student_id = '00000000-0000-4000-8000-000000001201'
      and course_id = '00000000-0000-4000-8000-000000001301'),
  1,
  'Duplicate capture does not create another enrollment'
);
select throws_ok(
  $$select public.complete_razorpay_course_payment(
    (select id from public.payments
      where provider_payment_id = 'pay_LPTestCourse0001'),
    'order_LPTestCourse0001',
    'pay_LPTestCourse0001',
    null,
    'INR',
    'upi'
  )$$,
  '42501',
  null,
  'Missing trusted amount cannot finalize a payment'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select * from public.create_pending_razorpay_subscription(
    '00000000-0000-4000-8000-000000001401'
  )$$,
  'Student checkout creates a pending finite subscription'
);
select is(
  (select creation_in_progress
    from public.create_pending_razorpay_subscription(
      '00000000-0000-4000-8000-000000001401'
    )),
  true,
  'Concurrent subscription checkout is rejected while provider creation is in progress'
);
select throws_ok(
  $$select * from public.create_pending_razorpay_subscription(
    '00000000-0000-4000-8000-000000001402'
  )$$,
  '23505',
  null,
  'A student cannot prepare a second subscription plan concurrently'
);

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);

select lives_ok(
  $$select public.attach_razorpay_plan(
    '00000000-0000-4000-8000-000000001401',
    'plan_LPTestPlan0001',
    'test'
  )$$,
  'Trusted processing links the provider plan and mode'
);
select lives_ok(
  $$select public.attach_razorpay_subscription(
    (select id from public.subscriptions
      where student_id = '00000000-0000-4000-8000-000000001201'
        and plan_id = '00000000-0000-4000-8000-000000001401'),
    'sub_LPTestSubscription0001'
  )$$,
  'Trusted processing links the provider subscription'
);
select lives_ok(
  $$select public.process_razorpay_webhook(
    'evt_LPTestSubscriptionAuthenticated001',
    'subscription.authenticated',
    jsonb_build_object(
      'created_at', extract(epoch from now())::bigint,
      'payload', jsonb_build_object(
        'subscription', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'sub_LPTestSubscription0001',
            'status', 'authenticated'
          )
        ),
        'payment', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'pay_LPTestAuth0001',
            'subscription_id', 'sub_LPTestSubscription0001',
            'amount', 100,
            'currency', 'INR',
            'status', 'authorized'
          )
        )
      )
    )
  )$$,
  'Authentication event with an initial authorization is processed'
);
select is(
  (select count(*)::integer from public.payments
    where subscription_id = (
      select id from public.subscriptions
      where provider_subscription_id = 'sub_LPTestSubscription0001'
    )),
  0,
  'Subscription authorization is not misrecorded as a recurring charge'
);
select lives_ok(
  $$select public.process_razorpay_webhook(
    'evt_LPTestSubscriptionInitialCaptured001',
    'subscription.authenticated',
    jsonb_build_object(
      'created_at', extract(epoch from now())::bigint + 1,
      'payload', jsonb_build_object(
        'subscription', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'sub_LPTestSubscription0001',
            'status', 'authenticated'
          )
        ),
        'payment', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'pay_LPTestInitialCaptured0001',
            'subscription_id', 'sub_LPTestSubscription0001',
            'amount', 100,
            'currency', 'INR',
            'status', 'captured'
          )
        )
      )
    )
  )$$,
  'A captured initial subscription payment is recorded'
);
select is(
  (select amount_cents from public.payments
    where provider_payment_id = 'pay_LPTestInitialCaptured0001'),
  100,
  'Initial subscription amount is recorded as paid'
);
select lives_ok(
  $$select public.process_razorpay_webhook(
    'evt_LPTestSubscriptionRetryFailed001',
    'payment.failed',
    jsonb_build_object(
      'created_at', extract(epoch from now())::bigint + 2,
      'payload', jsonb_build_object(
        'payment', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'pay_LPTestRetry0001',
            'subscription_id', 'sub_LPTestSubscription0001',
            'amount', 1800,
            'currency', 'INR',
            'status', 'failed',
            'error_code', 'BAD_REQUEST_ERROR'
          )
        )
      )
    )
  )$$,
  'A failed subscription charge is recorded'
);
select is(
  (select status from public.payments
    where provider_payment_id = 'pay_LPTestRetry0001'),
  'FAILED',
  'Failed recurring charge retains its provider status'
);
select lives_ok(
  $$select public.process_razorpay_webhook(
    'evt_LPTestSubscriptionCharged001',
    'subscription.charged',
    jsonb_build_object(
      'created_at', extract(epoch from now())::bigint + 10,
      'payload', jsonb_build_object(
        'subscription', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'sub_LPTestSubscription0001',
            'status', 'active',
            'current_start', extract(epoch from now())::bigint,
            'current_end', extract(epoch from now())::bigint + 2592000
          )
        ),
        'payment', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'pay_LPTestRetry0001',
            'subscription_id', 'sub_LPTestSubscription0001',
            'amount', 1800,
            'currency', 'INR',
            'status', 'captured',
            'method', 'upi'
          )
        )
      )
    )
  )$$,
  'A recurring charge is verified and recorded from the subscription webhook'
);
select is(
  (select status from public.subscriptions
    where provider_subscription_id = 'sub_LPTestSubscription0001'),
  'ACTIVE',
  'A charged subscription is active'
);
select is(
  (select count(*)::integer from public.payments
    where provider_payment_id = 'pay_LPTestRetry0001'
      and status = 'SUCCEEDED'),
  1,
  'A later captured event upgrades a failed attempt to a successful charge'
);
select lives_ok(
  $$select public.process_razorpay_webhook(
    'evt_LPTestSubscriptionPendingOlder001',
    'subscription.pending',
    jsonb_build_object(
      'created_at', extract(epoch from now())::bigint + 5,
      'payload', jsonb_build_object(
        'subscription', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'sub_LPTestSubscription0001',
            'status', 'pending'
          )
        )
      )
    )
  )$$,
  'An older state event is safely accepted'
);
select is(
  (select status from public.subscriptions
    where provider_subscription_id = 'sub_LPTestSubscription0001'),
  'ACTIVE',
  'An older event cannot overwrite the newer active state'
);
select lives_ok(
  $$select public.confirm_razorpay_subscription_cancellation(
    (select id from public.subscriptions
      where provider_subscription_id = 'sub_LPTestSubscription0001'),
    'active'
  )$$,
  'Provider-confirmed end-of-period cancellation is recorded'
);
select ok(
  (select cancel_at_period_end from public.subscriptions
    where provider_subscription_id = 'sub_LPTestSubscription0001'),
  'Cancellation is scheduled without prematurely ending the period'
);
select lives_ok(
  $$select public.process_razorpay_webhook(
    'evt_LPTestSubscriptionCancelled001',
    'subscription.cancelled',
    jsonb_build_object(
      'created_at', extract(epoch from now())::bigint + 20,
      'payload', jsonb_build_object(
        'subscription', jsonb_build_object(
          'entity', jsonb_build_object(
            'id', 'sub_LPTestSubscription0001',
            'status', 'cancelled'
          )
        )
      )
    )
  )$$,
  'A terminal cancellation webhook is processed'
);
select is(
  (select status from public.subscriptions
    where provider_subscription_id = 'sub_LPTestSubscription0001'),
  'CANCELLED',
  'A confirmed terminal cancellation updates subscription status'
);

select set_config(
  'test.subscription_id',
  (
    select id::text
    from public.subscriptions
    where provider_subscription_id = 'sub_LPTestSubscription0001'
  ),
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000001203',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is(
  (
    select total_count
    from public.admin_list_payment_records(
      current_setting('test.subscription_id'),
      null,
      1,
      25
    )
    limit 1
  ),
  2::bigint,
  'Administrators can filter related payments by subscription'
);
reset role;

select * from finish();
rollback;
