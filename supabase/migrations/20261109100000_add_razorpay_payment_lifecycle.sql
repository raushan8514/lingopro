alter table public.subscription_plans
  add column billing_cycles integer
    check (billing_cycles is null or billing_cycles > 0),
  add column razorpay_plan_id text,
  add column razorpay_plan_mode text
    check (razorpay_plan_mode is null or razorpay_plan_mode in ('test', 'live'));

create unique index subscription_plans_razorpay_plan_id_idx
  on public.subscription_plans (razorpay_plan_id)
  where razorpay_plan_id is not null;

alter table public.subscriptions
  drop constraint subscriptions_status_check,
  add constraint subscriptions_status_check
    check (status in (
      'PENDING',
      'TRIALING',
      'ACTIVE',
      'PAST_DUE',
      'HALTED',
      'PAUSED',
      'CANCELLED',
      'EXPIRED'
    )),
  add column cancel_at_period_end boolean not null default false,
  add column provider_state_updated_at timestamptz,
  add column provider_amount_cents integer
    check (provider_amount_cents is null or provider_amount_cents > 0),
  add column provider_currency text
    check (provider_currency is null or provider_currency ~ '^[A-Z]{3}$'),
  add column provider_plan_name text,
  add column provider_billing_cycles integer
    check (provider_billing_cycles is null or provider_billing_cycles > 0),
  add column provider_creation_started_at timestamptz;

alter table public.payments
  add column course_id uuid references public.courses (id) on delete restrict,
  add column transaction_reference text,
  add column idempotency_key uuid,
  add column purchase_description text,
  add column receipt_number text,
  add column payment_method text,
  add column failure_code text,
  add column failure_description text,
  add column refunded_amount_cents integer not null default 0
    check (refunded_amount_cents >= 0);

update public.payments as payment
set course_id = enrollment.course_id
from public.enrollments as enrollment
where payment.enrollment_id = enrollment.id
  and payment.student_id = enrollment.student_id
  and payment.course_id is null;

alter table public.payments
  drop constraint payments_check,
  drop constraint payments_status_check,
  drop constraint payments_enrollment_owner_fkey,
  add constraint payments_purchase_target_check
    check (num_nonnulls(course_id, subscription_id) = 1),
  add constraint payments_status_check
    check (status in (
      'PENDING',
      'AUTHORIZED',
      'SUCCEEDED',
      'FAILED',
      'REFUNDED',
      'PARTIALLY_REFUNDED'
    )),
  add constraint payments_enrollment_owner_fkey
    foreign key (enrollment_id, student_id, course_id)
    references public.enrollments (id, student_id, course_id)
    on delete restrict;

create unique index payments_transaction_reference_idx
  on public.payments (transaction_reference)
  where transaction_reference is not null;
create unique index payments_student_idempotency_key_idx
  on public.payments (student_id, idempotency_key)
  where idempotency_key is not null;
create unique index payments_receipt_number_idx
  on public.payments (receipt_number)
  where receipt_number is not null;
create index payments_course_idx on public.payments (course_id);

alter table public.payment_events
  add column processing_error text;

create or replace function public.create_pending_course_payment(
  target_course_id uuid,
  request_idempotency_key uuid
)
returns table (
  payment_id uuid,
  transaction_reference text,
  amount_cents integer,
  currency text,
  purchase_description text,
  provider_order_id text,
  payment_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  course_row public.courses%rowtype;
  payment_row public.payments%rowtype;
begin
  if actor_id is null
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;
  if target_course_id is null or request_idempotency_key is null then
    raise invalid_parameter_value using message = 'A course and checkout request are required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(actor_id::text || ':' || target_course_id::text, 0)
  );

  select course.* into course_row
  from public.courses as course
  where course.id = target_course_id
    and course.status = 'PUBLISHED'
  for share;

  if not found or course_row.price_cents <= 0 then
    raise check_violation using message = 'This course is not available for paid checkout.';
  end if;

  if exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.student_id = actor_id
      and enrollment.course_id = target_course_id
      and enrollment.status in ('ACTIVE', 'COMPLETED')
      and (enrollment.expires_at is null or enrollment.expires_at > now())
  ) then
    raise unique_violation using message = 'An active course enrollment already exists.';
  end if;

  update public.payments as payment
  set status = 'FAILED',
      failure_code = 'checkout_expired',
      failure_description = 'The pending checkout expired before an order was created.'
  where payment.student_id = actor_id
    and payment.course_id = target_course_id
    and payment.provider = 'RAZORPAY'
    and payment.status = 'PENDING'
    and payment.provider_order_id is null
    and payment.created_at < now() - interval '30 minutes';

  select payment.* into payment_row
  from public.payments as payment
  where payment.student_id = actor_id
    and payment.course_id = target_course_id
    and payment.provider = 'RAZORPAY'
    and payment.status in ('PENDING', 'AUTHORIZED')
  order by payment.created_at desc
  limit 1
  for update;

  if found then
    if payment_row.status = 'PENDING'
      and (
        payment_row.amount_cents <> course_row.price_cents
        or payment_row.currency <> course_row.currency
      ) then
      update public.payments
      set status = 'FAILED',
          failure_code = 'course_price_changed',
          failure_description = 'The published course price changed before checkout completed.'
      where id = payment_row.id;
      payment_row.id := null;
    else
      if payment_row.idempotency_key is distinct from request_idempotency_key
        and payment_row.provider_order_id is null then
        update public.payments as payment
        set idempotency_key = request_idempotency_key
        where payment.id = payment_row.id;
        payment_row.idempotency_key := request_idempotency_key;
      end if;
      return query select payment_row.id, payment_row.transaction_reference,
        payment_row.amount_cents, payment_row.currency,
        payment_row.purchase_description, payment_row.provider_order_id,
        payment_row.status;
      return;
    end if;
  end if;

  insert into public.payments (
    student_id,
    course_id,
    amount_cents,
    currency,
    provider,
    status,
    transaction_reference,
    idempotency_key,
    purchase_description
  )
  values (
    actor_id,
    course_row.id,
    course_row.price_cents,
    course_row.currency,
    'RAZORPAY',
    'PENDING',
    'LP-' || upper(replace(gen_random_uuid()::text, '-', '')),
    request_idempotency_key,
    course_row.title
  )
  returning * into payment_row;

  return query select payment_row.id, payment_row.transaction_reference,
    payment_row.amount_cents, payment_row.currency,
    payment_row.purchase_description, payment_row.provider_order_id,
    payment_row.status;
end;
$$;

create or replace function public.attach_razorpay_order(
  target_payment_id uuid,
  target_order_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
begin
  if auth.role() is distinct from 'service_role'
    or target_payment_id is null
    or target_order_id is null
    or target_order_id !~ '^order_[A-Za-z0-9]+$' then
    raise insufficient_privilege using message = 'Trusted payment processing is required.';
  end if;

  select payment.* into payment_row
  from public.payments as payment
  where payment.id = target_payment_id
    and payment.provider = 'RAZORPAY'
    and payment.course_id is not null
  for update;

  if not found or payment_row.status not in ('PENDING', 'AUTHORIZED') then
    raise check_violation using message = 'The payment is not available for order attachment.';
  end if;
  if payment_row.provider_order_id is not null
    and payment_row.provider_order_id <> target_order_id then
    raise unique_violation using message = 'A different provider order is already attached.';
  end if;

  update public.payments
  set provider_order_id = target_order_id
  where id = target_payment_id;
end;
$$;

create or replace function public.complete_razorpay_course_payment(
  target_payment_id uuid,
  target_order_id text,
  target_provider_payment_id text,
  target_amount_cents integer,
  target_currency text,
  target_payment_method text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
  v_enrollment_id uuid;
begin
  if auth.role() is distinct from 'service_role'
    or target_payment_id is null
    or target_order_id is null
    or target_provider_payment_id is null
    or target_order_id !~ '^order_[A-Za-z0-9]+$'
    or target_provider_payment_id !~ '^pay_[A-Za-z0-9]+$'
    or target_amount_cents is null
    or target_amount_cents <= 0
    or target_currency is null
    or target_currency !~ '^[A-Z]{3}$' then
    raise insufficient_privilege using message = 'Trusted payment processing is required.';
  end if;

  select payment.* into payment_row
  from public.payments as payment
  where payment.id = target_payment_id
    and payment.provider = 'RAZORPAY'
    and payment.course_id is not null
  for update;

  if not found
    or payment_row.provider_order_id <> target_order_id
    or payment_row.amount_cents <> target_amount_cents
    or payment_row.currency <> target_currency
    or payment_row.status in ('REFUNDED', 'PARTIALLY_REFUNDED') then
    raise check_violation using message = 'The verified payment does not match the stored purchase.';
  end if;

  if payment_row.status <> 'SUCCEEDED' then
    update public.payments
    set status = 'SUCCEEDED',
        provider_payment_id = target_provider_payment_id,
        paid_at = coalesce(paid_at, now()),
        payment_method = case
          when target_payment_method in (
            'card', 'netbanking', 'wallet', 'emi', 'upi', 'paylater', 'bank_transfer'
          ) then target_payment_method
          else null
        end,
        failure_code = null,
        failure_description = null,
        receipt_number = coalesce(
          receipt_number,
          'LP-REC-' || upper(replace(transaction_reference, '-', ''))
        )
    where id = target_payment_id;
  elsif payment_row.provider_payment_id is distinct from target_provider_payment_id then
    raise unique_violation using message = 'A different payment is already recorded.';
  end if;

  select enrollment.id into v_enrollment_id
  from public.enrollments as enrollment
  where enrollment.student_id = payment_row.student_id
    and enrollment.course_id = payment_row.course_id
    and enrollment.status in ('ACTIVE', 'COMPLETED')
    and (enrollment.expires_at is null or enrollment.expires_at > now())
  order by enrollment.enrolled_at desc
  limit 1;

  if v_enrollment_id is null then
    insert into public.enrollments (
      student_id, course_id, status, enrollment_type
    )
    values (
      payment_row.student_id, payment_row.course_id, 'ACTIVE', 'PAID'
    )
    on conflict (student_id, course_id) where status = 'ACTIVE' do nothing
    returning id into v_enrollment_id;

    if v_enrollment_id is null then
      select enrollment.id into v_enrollment_id
      from public.enrollments as enrollment
      where enrollment.student_id = payment_row.student_id
        and enrollment.course_id = payment_row.course_id
        and enrollment.status = 'ACTIVE'
        and (enrollment.expires_at is null or enrollment.expires_at > now())
      limit 1;
    end if;
  end if;

  if v_enrollment_id is null then
    raise check_violation using message = 'The verified payment could not activate course access.';
  end if;

  update public.payments
  set enrollment_id = v_enrollment_id
  where id = target_payment_id
    and public.payments.enrollment_id is null;

  return v_enrollment_id;
end;
$$;

create or replace function public.create_pending_razorpay_subscription(
  target_plan_id uuid
)
returns table (
  subscription_id uuid,
  plan_name text,
  plan_description text,
  amount_cents integer,
  currency text,
  billing_interval text,
  interval_count integer,
  billing_cycles integer,
  razorpay_plan_id text,
  razorpay_plan_mode text,
  existing_provider_subscription_id text,
  provider_amount_cents integer,
  provider_currency text,
  provider_plan_name text,
  provider_billing_cycles integer,
  creation_in_progress boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  plan_row public.subscription_plans%rowtype;
  subscription_row public.subscriptions%rowtype;
  owns_creation_lease boolean := false;
begin
  if actor_id is null
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;
  if target_plan_id is null then
    raise invalid_parameter_value using message = 'Choose a subscription plan.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(actor_id::text || ':razorpay-subscription', 0)
  );

  select plan.* into plan_row
  from public.subscription_plans as plan
  where plan.id = target_plan_id
    and plan.is_active
    and plan.price_cents > 0
    and plan.billing_interval in ('MONTH', 'YEAR')
    and plan.billing_cycles is not null
  for share;

  if not found then
    raise check_violation using message = 'This subscription plan is not configured for checkout.';
  end if;

  if exists (
    select 1 from public.subscriptions as subscription
    where subscription.student_id = actor_id
      and subscription.status in ('ACTIVE', 'TRIALING', 'PAST_DUE', 'HALTED', 'PAUSED')
      and (
        subscription.current_period_end is null
        or subscription.current_period_end > now()
      )
  ) then
    raise unique_violation using message = 'An active subscription already exists.';
  end if;

  update public.subscriptions as subscription
  set status = 'EXPIRED'
  where subscription.student_id = actor_id
    and subscription.status = 'PENDING'
    and subscription.provider = 'RAZORPAY'
    and subscription.provider_subscription_id is null
    and subscription.created_at < now() - interval '30 minutes';

  if exists (
    select 1 from public.subscriptions as subscription
    where subscription.student_id = actor_id
      and subscription.status = 'PENDING'
      and (
        subscription.provider <> 'RAZORPAY'
        or subscription.plan_id <> target_plan_id
      )
  ) then
    raise unique_violation using message = 'Another subscription checkout is already pending.';
  end if;

  select subscription.* into subscription_row
  from public.subscriptions as subscription
  where subscription.student_id = actor_id
    and subscription.plan_id = target_plan_id
    and subscription.provider = 'RAZORPAY'
    and subscription.status = 'PENDING'
  order by subscription.created_at desc
  limit 1
  for update;

  if not found then
    insert into public.subscriptions (
      student_id, plan_id, status, provider, provider_amount_cents,
      provider_currency, provider_plan_name, provider_billing_cycles,
      provider_creation_started_at
    )
    values (
      actor_id, plan_row.id, 'PENDING', 'RAZORPAY', plan_row.price_cents,
      plan_row.currency, plan_row.name, plan_row.billing_cycles, now()
    )
    returning * into subscription_row;
    owns_creation_lease := true;
  elsif subscription_row.provider_subscription_id is null
    and (
      subscription_row.provider_creation_started_at is null
      or subscription_row.provider_creation_started_at < now() - interval '10 minutes'
    ) then
    update public.subscriptions
    set provider_creation_started_at = now()
    where id = subscription_row.id
    returning * into subscription_row;
    owns_creation_lease := true;
  end if;

  return query select subscription_row.id, plan_row.name, plan_row.description,
    plan_row.price_cents, plan_row.currency, plan_row.billing_interval,
    plan_row.interval_count, plan_row.billing_cycles, plan_row.razorpay_plan_id,
    plan_row.razorpay_plan_mode, subscription_row.provider_subscription_id,
    subscription_row.provider_amount_cents, subscription_row.provider_currency,
    subscription_row.provider_plan_name, subscription_row.provider_billing_cycles,
    subscription_row.provider_subscription_id is null and not owns_creation_lease;
end;
$$;

create or replace function public.attach_razorpay_plan(
  target_plan_id uuid,
  target_razorpay_plan_id text,
  target_razorpay_plan_mode text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_plan_id text;
begin
  if auth.role() is distinct from 'service_role'
    or target_plan_id is null
    or target_razorpay_plan_id is null
    or target_razorpay_plan_mode is null
    or target_razorpay_plan_mode not in ('test', 'live')
    or target_razorpay_plan_id !~ '^plan_[A-Za-z0-9]+$' then
    raise insufficient_privilege using message = 'Trusted payment processing is required.';
  end if;

  update public.subscription_plans
  set razorpay_plan_id = target_razorpay_plan_id,
      razorpay_plan_mode = target_razorpay_plan_mode
  where id = target_plan_id
    and (
      razorpay_plan_id is null
      or razorpay_plan_mode is distinct from target_razorpay_plan_mode
    );

  select razorpay_plan_id into stored_plan_id
  from public.subscription_plans
  where id = target_plan_id;

  if stored_plan_id is null
    or not exists (
      select 1
      from public.subscription_plans
      where id = target_plan_id
        and razorpay_plan_mode = target_razorpay_plan_mode
    ) then
    raise no_data_found using message = 'The subscription plan no longer exists.';
  end if;

  return stored_plan_id;
end;
$$;

create or replace function public.attach_razorpay_subscription(
  target_subscription_id uuid,
  target_razorpay_subscription_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role'
    or target_subscription_id is null
    or target_razorpay_subscription_id is null
    or target_razorpay_subscription_id !~ '^sub_[A-Za-z0-9]+$' then
    raise insufficient_privilege using message = 'Trusted payment processing is required.';
  end if;

  update public.subscriptions
  set provider_subscription_id = target_razorpay_subscription_id,
      provider_creation_started_at = null
  where id = target_subscription_id
    and provider = 'RAZORPAY'
    and status = 'PENDING'
    and (provider_subscription_id is null
      or provider_subscription_id = target_razorpay_subscription_id);

  if not found then
    raise check_violation using message = 'The subscription is not available for provider attachment.';
  end if;
end;
$$;

create or replace function public.expire_pending_razorpay_subscription(
  target_subscription_id uuid,
  provider_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role'
    or target_subscription_id is null
    or provider_status is null
    or provider_status not in ('cancelled', 'completed', 'expired') then
    raise insufficient_privilege using message = 'Trusted payment processing is required.';
  end if;

  update public.subscriptions
  set status = case
        when provider_status = 'cancelled' then 'CANCELLED'
        else 'EXPIRED'
      end,
      cancelled_at = case
        when provider_status = 'cancelled' then coalesce(cancelled_at, now())
        else cancelled_at
      end,
      provider_state_updated_at = now(),
      provider_creation_started_at = null
  where id = target_subscription_id
    and provider = 'RAZORPAY'
    and status = 'PENDING'
    and provider_subscription_id is not null;

  if not found then
    raise no_data_found using message = 'The pending provider subscription was not found.';
  end if;
end;
$$;

create or replace function public.complete_razorpay_subscription_payment(
  target_subscription_id uuid,
  target_provider_subscription_id text,
  target_provider_payment_id text,
  target_amount_cents integer,
  target_currency text,
  target_payment_method text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_row public.subscriptions%rowtype;
  plan_row public.subscription_plans%rowtype;
  recorded_payment_id uuid;
begin
  if auth.role() is distinct from 'service_role'
    or target_subscription_id is null
    or target_provider_subscription_id is null
    or target_provider_payment_id is null
    or target_provider_subscription_id !~ '^sub_[A-Za-z0-9]+$'
    or target_provider_payment_id !~ '^pay_[A-Za-z0-9]+$'
    or target_amount_cents is null
    or target_amount_cents <= 0
    or target_currency is null
    or target_currency !~ '^[A-Z]{3}$' then
    raise insufficient_privilege using message = 'Trusted payment processing is required.';
  end if;

  select subscription.* into subscription_row
  from public.subscriptions as subscription
  where subscription.id = target_subscription_id
    and subscription.provider = 'RAZORPAY'
    and subscription.provider_subscription_id = target_provider_subscription_id
  for update;

  if not found then
    raise no_data_found using message = 'The provider subscription could not be matched.';
  end if;

  select plan.* into plan_row
  from public.subscription_plans as plan
  where plan.id = subscription_row.plan_id;

  if not found then
    raise no_data_found using message = 'The subscription plan could not be matched.';
  end if;

  if target_currency <> coalesce(subscription_row.provider_currency, plan_row.currency)
    or (
      subscription_row.provider_amount_cents is not null
      and target_amount_cents <> subscription_row.provider_amount_cents
    ) then
    raise check_violation using message = 'The verified subscription payment does not match its stored terms.';
  end if;

  insert into public.payments as existing_payment (
    student_id,
    subscription_id,
    amount_cents,
    currency,
    provider,
    provider_payment_id,
    status,
    paid_at,
    payment_method,
    transaction_reference,
    purchase_description,
    receipt_number
  )
  values (
    subscription_row.student_id,
    subscription_row.id,
    target_amount_cents,
    target_currency,
    'RAZORPAY',
    target_provider_payment_id,
    'SUCCEEDED',
    now(),
    case
      when target_payment_method in (
        'card', 'netbanking', 'wallet', 'emi', 'upi', 'paylater', 'bank_transfer'
      ) then target_payment_method
      else null
    end,
    'LP-' || upper(replace(gen_random_uuid()::text, '-', '')),
    coalesce(subscription_row.provider_plan_name, plan_row.name),
    'LP-REC-' || upper(replace(gen_random_uuid()::text, '-', ''))
  )
  on conflict (provider, provider_payment_id)
    where provider_payment_id is not null
  do update set
    status = 'SUCCEEDED',
    paid_at = coalesce(existing_payment.paid_at, excluded.paid_at),
    payment_method = coalesce(excluded.payment_method, existing_payment.payment_method),
    failure_code = null,
    failure_description = null,
    receipt_number = coalesce(existing_payment.receipt_number, excluded.receipt_number)
  where existing_payment.subscription_id = excluded.subscription_id
    and existing_payment.amount_cents = excluded.amount_cents
    and existing_payment.currency = excluded.currency
    and existing_payment.status in ('PENDING', 'AUTHORIZED', 'FAILED', 'SUCCEEDED')
  returning id into recorded_payment_id;

  if recorded_payment_id is null then
    raise unique_violation using message = 'The provider payment is already linked to a different purchase.';
  end if;
end;
$$;

create or replace function public.confirm_razorpay_subscription_cancellation(
  target_subscription_id uuid,
  provider_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role'
    or target_subscription_id is null
    or provider_status is null
    or provider_status not in ('active', 'cancelled', 'completed', 'expired') then
    raise insufficient_privilege using message = 'Trusted payment processing is required.';
  end if;

  update public.subscriptions
  set cancel_at_period_end = provider_status = 'active',
      status = case
        when provider_status = 'cancelled' then 'CANCELLED'
        when provider_status in ('completed', 'expired') then 'EXPIRED'
        else status
      end,
      cancelled_at = case
        when provider_status = 'cancelled' then coalesce(cancelled_at, now())
        else cancelled_at
      end
  where id = target_subscription_id
    and provider = 'RAZORPAY'
    and provider_subscription_id is not null;

  if not found then
    raise no_data_found using message = 'The active provider subscription was not found.';
  end if;
end;
$$;

create or replace function public.log_razorpay_webhook_failure(
  target_event_id text,
  target_event_type text,
  safe_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role'
    or target_event_id is null
    or target_event_type is null then
    raise insufficient_privilege using message = 'Trusted webhook processing is required.';
  end if;

  insert into public.payment_events (
    provider, provider_event_id, event_type, processing_status, processing_error
  )
  values (
    'RAZORPAY',
    left(target_event_id, 255),
    left(target_event_type, 160),
    'FAILED',
    left(nullif(btrim(safe_error_code), ''), 120)
  )
  on conflict (provider, provider_event_id)
  do update set processing_status = 'FAILED',
      processing_error = excluded.processing_error
    where public.payment_events.processing_status <> 'PROCESSED';
end;
$$;

create or replace function public.process_razorpay_webhook(
  target_event_id text,
  target_event_type text,
  event_body jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_entity jsonb;
  subscription_entity jsonb;
  payment_row public.payments%rowtype;
  subscription_row public.subscriptions%rowtype;
  v_event_timestamp timestamptz;
  v_provider_payment_id text;
  v_provider_subscription_id text;
  v_provider_order_id text;
  v_amount_value integer;
  v_currency_value text;
  v_method_value text;
  v_mapped_status text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_existing_event_status text;
  inserted_event_id uuid;
  v_subscription_found boolean;
  recorded_payment_id uuid;
begin
  if auth.role() is distinct from 'service_role'
    or target_event_id is null
    or char_length(target_event_id) not between 1 and 255
    or target_event_type is null
    or char_length(target_event_type) not between 1 and 160
    or jsonb_typeof(event_body) is distinct from 'object' then
    raise insufficient_privilege using message = 'Trusted webhook processing is required.';
  end if;

  begin
    v_event_timestamp := coalesce(
      to_timestamp((event_body->>'created_at')::double precision),
      now()
    );
  exception when others then
    v_event_timestamp := now();
  end;

  insert into public.payment_events (
    provider, provider_event_id, event_type, processing_status
  )
  values ('RAZORPAY', target_event_id, target_event_type, 'PROCESSING')
  on conflict (provider, provider_event_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    select event.id, event.processing_status
    into inserted_event_id, v_existing_event_status
    from public.payment_events as event
    where event.provider = 'RAZORPAY'
      and event.provider_event_id = target_event_id
    for update;

    if v_existing_event_status = 'PROCESSED' then
      return jsonb_build_object('duplicate', true);
    end if;

    update public.payment_events
    set processing_status = 'PROCESSING',
        processing_error = null
    where id = inserted_event_id;
  end if;

  payment_entity := coalesce(
    event_body #> '{payload,payment,entity}',
    event_body #> '{payload,subscription,entity,payment,entity}'
  );
  subscription_entity := event_body #> '{payload,subscription,entity}';

  if target_event_type in (
    'payment.authorized', 'payment.captured', 'payment.failed',
    'subscription.charged', 'subscription.authenticated'
  ) and jsonb_typeof(payment_entity) = 'object' then
    v_provider_payment_id := payment_entity->>'id';
    v_provider_order_id := payment_entity->>'order_id';
    v_provider_subscription_id := coalesce(
      payment_entity->>'subscription_id',
      subscription_entity->>'id'
    );
    v_amount_value := nullif(payment_entity->>'amount', '')::integer;
    v_currency_value := payment_entity->>'currency';
    v_method_value := payment_entity->>'method';

    select payment.* into payment_row
    from public.payments as payment
    where payment.provider = 'RAZORPAY'
      and payment.course_id is not null
      and payment.provider_order_id = v_provider_order_id
    for update;

    if found then
      if v_amount_value is distinct from payment_row.amount_cents
        or v_currency_value is distinct from payment_row.currency
        or v_provider_payment_id is null
        or v_provider_payment_id !~ '^pay_[A-Za-z0-9]+$' then
        raise check_violation using message = 'Webhook payment details do not match the stored order.';
      end if;

      if target_event_type = 'payment.captured' then
        perform public.complete_razorpay_course_payment(
          payment_row.id,
          v_provider_order_id,
          v_provider_payment_id,
          v_amount_value,
          v_currency_value,
          v_method_value
        );
      elsif target_event_type = 'payment.authorized'
        and payment_row.status = 'PENDING' then
        update public.payments
        set status = 'AUTHORIZED',
            provider_payment_id = v_provider_payment_id
        where id = payment_row.id;
      elsif target_event_type = 'payment.failed'
        and payment_row.status = 'PENDING' then
        update public.payments
        set status = 'FAILED',
            provider_payment_id = v_provider_payment_id,
            failure_code = left(payment_entity #>> '{error_code}', 120),
            failure_description = left(payment_entity #>> '{error_description}', 500)
        where id = payment_row.id;
      end if;
    elsif v_provider_subscription_id is not null then
      select subscription.* into subscription_row
      from public.subscriptions as subscription
      where subscription.provider = 'RAZORPAY'
        and subscription.provider_subscription_id = v_provider_subscription_id
      for update;
      v_subscription_found := found;

      if v_subscription_found then
        if v_provider_payment_id is null
          or v_provider_payment_id !~ '^pay_[A-Za-z0-9]+$'
          or v_amount_value is null
          or v_amount_value <= 0
          or v_currency_value is null
          or v_currency_value !~ '^[A-Z]{3}$' then
          raise check_violation using message = 'Subscription payment details are invalid.';
        end if;

        if target_event_type = 'subscription.charged'
          and v_amount_value is distinct from coalesce(
            subscription_row.provider_amount_cents,
            (
              select plan.price_cents
              from public.subscription_plans as plan
              where plan.id = subscription_row.plan_id
            )
          ) then
          raise check_violation using message = 'Subscription charge amount does not match the configured plan.';
        end if;

        if target_event_type = 'subscription.authenticated'
          and payment_entity->>'status' = 'captured' then
          if v_currency_value <> coalesce(
            subscription_row.provider_currency,
            (
              select plan.currency
              from public.subscription_plans as plan
              where plan.id = subscription_row.plan_id
            )
          ) then
            raise check_violation using message = 'Initial subscription payment currency does not match.';
          end if;

          insert into public.payments as existing_payment (
            student_id, subscription_id, amount_cents, currency, provider,
            provider_payment_id, status, paid_at, payment_method,
            transaction_reference, purchase_description, receipt_number
          )
          values (
            subscription_row.student_id,
            subscription_row.id,
            v_amount_value,
            v_currency_value,
            'RAZORPAY',
            v_provider_payment_id,
            'SUCCEEDED',
            now(),
            case
              when v_method_value in (
                'card', 'netbanking', 'wallet', 'emi', 'upi', 'paylater', 'bank_transfer'
              ) then v_method_value
              else null
            end,
            'LP-' || upper(replace(gen_random_uuid()::text, '-', '')),
            coalesce(subscription_row.provider_plan_name, 'Subscription') || ' initial payment',
            'LP-REC-' || upper(replace(gen_random_uuid()::text, '-', ''))
          )
          on conflict (provider, provider_payment_id)
            where provider_payment_id is not null
          do update set
            status = 'SUCCEEDED',
            paid_at = coalesce(existing_payment.paid_at, excluded.paid_at),
            payment_method = coalesce(excluded.payment_method, existing_payment.payment_method),
            failure_code = null,
            failure_description = null,
            receipt_number = coalesce(existing_payment.receipt_number, excluded.receipt_number)
          where existing_payment.subscription_id = excluded.subscription_id
            and existing_payment.amount_cents = excluded.amount_cents
            and existing_payment.currency = excluded.currency
            and existing_payment.status in ('PENDING', 'AUTHORIZED', 'FAILED', 'SUCCEEDED')
          returning id into recorded_payment_id;

          if recorded_payment_id is null then
            raise unique_violation using message = 'The initial provider payment is already linked to a different purchase.';
          end if;
        end if;

        if target_event_type = 'subscription.authenticated' then
          null;
        elsif target_event_type in ('payment.captured', 'subscription.charged') then
          perform public.complete_razorpay_subscription_payment(
            subscription_row.id,
            v_provider_subscription_id,
            v_provider_payment_id,
            v_amount_value,
            v_currency_value,
            v_method_value
          );
        elsif target_event_type = 'payment.failed' then
          insert into public.payments (
            student_id, subscription_id, amount_cents, currency, provider,
            provider_payment_id, status, payment_method, transaction_reference,
            purchase_description, failure_code, failure_description
          )
          select subscription_row.student_id,
            subscription_row.id,
            v_amount_value,
            v_currency_value,
            'RAZORPAY',
            v_provider_payment_id,
            'FAILED',
            v_method_value,
            'LP-' || upper(replace(gen_random_uuid()::text, '-', '')),
            coalesce(subscription_row.provider_plan_name, plan.name),
            left(payment_entity #>> '{error_code}', 120),
            left(payment_entity #>> '{error_description}', 500)
          from public.subscription_plans as plan
          where plan.id = subscription_row.plan_id
          on conflict (provider, provider_payment_id)
            where provider_payment_id is not null
          do nothing;
        else
          raise no_data_found using message = 'The provider payment could not be matched to a purchase.';
        end if;
      else
        raise no_data_found using message = 'The provider subscription could not be matched to the payment.';
      end if;
    else
      raise no_data_found using message = 'The provider payment could not be matched to a purchase.';
    end if;
  end if;

  if jsonb_typeof(subscription_entity) = 'object' then
    v_provider_subscription_id := subscription_entity->>'id';
    select subscription.* into subscription_row
    from public.subscriptions as subscription
    where subscription.provider = 'RAZORPAY'
      and subscription.provider_subscription_id = v_provider_subscription_id
    for update;
    v_subscription_found := found;

    if v_subscription_found then
      v_mapped_status := case target_event_type
        when 'subscription.activated' then 'ACTIVE'
        when 'subscription.charged' then 'ACTIVE'
        when 'subscription.resumed' then 'ACTIVE'
        when 'subscription.authenticated' then 'PENDING'
        when 'subscription.pending' then 'PAST_DUE'
        when 'subscription.halted' then 'HALTED'
        when 'subscription.paused' then 'PAUSED'
        when 'subscription.cancelled' then 'CANCELLED'
        when 'subscription.completed' then 'EXPIRED'
        else null
      end;

      if v_mapped_status is not null
        and v_event_timestamp >= coalesce(
          subscription_row.provider_state_updated_at,
          '-infinity'::timestamptz
        ) then
        v_period_start := case
          when nullif(subscription_entity->>'current_start', '') is null then null
          else to_timestamp((subscription_entity->>'current_start')::double precision)
        end;
        v_period_end := case
          when nullif(subscription_entity->>'current_end', '') is null then null
          else to_timestamp((subscription_entity->>'current_end')::double precision)
        end;

        update public.subscriptions
        set status = v_mapped_status,
            provider_state_updated_at = v_event_timestamp,
            current_period_start = coalesce(v_period_start, current_period_start),
            current_period_end = coalesce(v_period_end, current_period_end),
            cancelled_at = case
              when v_mapped_status = 'CANCELLED' then coalesce(cancelled_at, v_event_timestamp)
              else cancelled_at
            end,
            cancel_at_period_end = case
              when v_mapped_status = 'CANCELLED' then false
              else cancel_at_period_end
            end
        where id = subscription_row.id;
      end if;
    elsif target_event_type like 'subscription.%' then
      raise no_data_found using message = 'The provider subscription could not be matched.';
    end if;
  end if;

  update public.payment_events
  set processing_status = 'PROCESSED',
      processed_at = now(),
      processing_error = null
  where id = inserted_event_id;

  return jsonb_build_object('duplicate', false, 'processed', true);
exception when others then
  if inserted_event_id is not null then
    update public.payment_events
    set processing_status = 'FAILED',
        processing_error = left(sqlstate || ': ' || sqlerrm, 500)
    where id = inserted_event_id;
  end if;
  raise;
end;
$$;

create or replace function public.admin_list_payment_records(
  search_term text default null,
  status_filter text default null,
  page_number integer default 1,
  page_size integer default 25
)
returns table (
  payment_id uuid,
  student_id uuid,
  transaction_reference text,
  purchase_description text,
  amount_cents integer,
  currency text,
  payment_status text,
  provider_order_id text,
  provider_payment_id text,
  payment_method text,
  failure_code text,
  failure_description text,
  receipt_number text,
  paid_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;

  return query
  with matched as (
    select payment.*
    from public.payments as payment
    where (nullif(btrim(coalesce(status_filter, '')), '') is null
      or payment.status = upper(btrim(status_filter)))
      and (
        nullif(btrim(coalesce(search_term, '')), '') is null
        or payment.transaction_reference ilike '%' || btrim(search_term) || '%'
        or payment.provider_order_id ilike '%' || btrim(search_term) || '%'
        or payment.provider_payment_id ilike '%' || btrim(search_term) || '%'
      )
  )
  select matched.id, matched.student_id, matched.transaction_reference,
    matched.purchase_description, matched.amount_cents, matched.currency,
    matched.status, matched.provider_order_id, matched.provider_payment_id,
    matched.payment_method, matched.failure_code, matched.failure_description,
    matched.receipt_number, matched.paid_at, matched.created_at,
    count(*) over ()
  from matched
  order by matched.created_at desc, matched.id
  limit least(greatest(coalesce(page_size, 25), 1), 100)
  offset (least(greatest(coalesce(page_number, 1), 1), 10000) - 1)
    * least(greatest(coalesce(page_size, 25), 1), 100);
end;
$$;



-- Restrict direct client access to payment records.
revoke all privileges on table public.payments
  from anon, authenticated;

grant select on table public.payments
  to authenticated;

-- Payment events are managed only by trusted server operations.
revoke all privileges on table public.payment_events
  from anon, authenticated;




revoke all on function public.create_pending_course_payment(uuid, uuid)
  from public, anon;
revoke all on function public.attach_razorpay_order(uuid, text)
  from public, anon, authenticated;
revoke all on function public.complete_razorpay_course_payment(uuid, text, text, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.create_pending_razorpay_subscription(uuid)
  from public, anon;
revoke all on function public.attach_razorpay_plan(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.attach_razorpay_subscription(uuid, text)
  from public, anon, authenticated;
revoke all on function public.expire_pending_razorpay_subscription(uuid, text)
  from public, anon, authenticated;
revoke all on function public.complete_razorpay_subscription_payment(uuid, text, text, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.confirm_razorpay_subscription_cancellation(uuid, text)
  from public, anon, authenticated;
revoke all on function public.log_razorpay_webhook_failure(text, text, text)
  from public, anon, authenticated;
revoke all on function public.process_razorpay_webhook(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_list_payment_records(text, text, integer, integer)
  from public, anon;



grant execute on function public.create_pending_course_payment(uuid, uuid)
  to authenticated;
grant execute on function public.create_pending_razorpay_subscription(uuid)
  to authenticated;
grant execute on function public.attach_razorpay_order(uuid, text)
  to service_role;
grant execute on function public.complete_razorpay_course_payment(uuid, text, text, integer, text, text)
  to service_role;
grant execute on function public.attach_razorpay_plan(uuid, text, text)
  to service_role;
grant execute on function public.attach_razorpay_subscription(uuid, text)
  to service_role;
grant execute on function public.expire_pending_razorpay_subscription(uuid, text)
  to service_role;
grant execute on function public.complete_razorpay_subscription_payment(uuid, text, text, integer, text, text)
  to service_role;
grant execute on function public.confirm_razorpay_subscription_cancellation(uuid, text)
  to service_role;
grant execute on function public.log_razorpay_webhook_failure(text, text, text)
  to service_role;
grant execute on function public.process_razorpay_webhook(text, text, jsonb)
  to service_role;
grant execute on function public.admin_list_payment_records(text, text, integer, integer)
  to authenticated;
