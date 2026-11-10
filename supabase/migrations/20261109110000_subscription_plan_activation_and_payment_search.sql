alter table public.subscription_plans
  alter column is_active set default false;

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
        or payment.subscription_id::text = btrim(search_term)
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
