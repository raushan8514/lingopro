create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    check (char_length(btrim(full_name)) between 1 and 120),
  email text not null,
  avatar_url text,
  role text not null default 'student'
    check (role in ('student', 'instructor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_idx on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

revoke all on function public.set_updated_at() from public, anon, authenticated;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      'LingoPro learner'
    ),
    lower(new.email),
    'student'
  );
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, full_name, email, role)
select
  id,
  coalesce(
    nullif(btrim(raw_user_meta_data ->> 'full_name'), ''),
    'LingoPro learner'
  ),
  lower(email),
  'student'
from auth.users
where email is not null
on conflict (id) do nothing;

create function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = lower(new.email)
    where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_auth_user_email() from public, anon, authenticated;

create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.sync_auth_user_email();

create function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;

alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

create policy "Users read their own profile and admins read all profiles"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id or (select public.current_user_is_admin()));

create policy "Users update permitted fields on their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;

  if new_role is null or new_role not in ('student', 'instructor', 'admin') then
    raise check_violation using message = 'Invalid account role.';
  end if;

  if target_user_id = (select auth.uid()) and new_role <> 'admin' then
    raise check_violation using message = 'Administrators cannot demote their own account.';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;

  if not found then
    raise no_data_found using message = 'The target profile does not exist.';
  end if;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
