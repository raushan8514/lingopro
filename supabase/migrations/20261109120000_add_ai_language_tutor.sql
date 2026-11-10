create table public.ai_tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  mode text not null check (
    mode in (
      'conversation',
      'grammar',
      'vocabulary',
      'writing',
      'interview',
      'daily-practice'
    )
  ),
  language text not null check (
    language in (
      'Arabic',
      'English',
      'French',
      'German',
      'Hindi',
      'Italian',
      'Japanese',
      'Korean',
      'Mandarin Chinese',
      'Portuguese',
      'Spanish'
    )
  ),
  level text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  topic text not null default '' check (char_length(topic) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_tutor_conversations_student_updated_idx
  on public.ai_tutor_conversations (student_id, updated_at desc);

create trigger ai_tutor_conversations_set_updated_at
before update on public.ai_tutor_conversations
for each row execute function public.set_updated_at();

create table public.ai_tutor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_tutor_conversations (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(btrim(content)) between 1 and 12000),
  created_at timestamptz not null default now()
);

create index ai_tutor_messages_conversation_created_idx
  on public.ai_tutor_messages (conversation_id, created_at, id);

create function public.touch_ai_tutor_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_tutor_conversations
  set updated_at = now()
  where id = new.conversation_id
    and student_id = new.student_id;
  return new;
end;
$$;

revoke all on function public.touch_ai_tutor_conversation() from public, anon, authenticated;

create trigger ai_tutor_messages_touch_conversation
after insert on public.ai_tutor_messages
for each row execute function public.touch_ai_tutor_conversation();

create table public.student_saved_vocabulary (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  source_conversation_id uuid references public.ai_tutor_conversations (id) on delete set null,
  word text not null check (char_length(btrim(word)) between 1 and 100),
  meaning text not null check (char_length(btrim(meaning)) between 1 and 200),
  language text not null check (
    language in (
      'Arabic',
      'English',
      'French',
      'German',
      'Hindi',
      'Italian',
      'Japanese',
      'Korean',
      'Mandarin Chinese',
      'Portuguese',
      'Spanish'
    )
  ),
  example text check (example is null or char_length(example) <= 500),
  created_at timestamptz not null default now(),
  constraint student_saved_vocabulary_unique
    unique (student_id, language, word)
);

create index student_saved_vocabulary_student_created_idx
  on public.student_saved_vocabulary (student_id, created_at desc);

create table public.ai_tutor_daily_usage (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  usage_date date not null,
  request_count integer not null check (request_count between 1 and 20)
);

alter table public.ai_tutor_conversations enable row level security;
alter table public.ai_tutor_messages enable row level security;
alter table public.student_saved_vocabulary enable row level security;
alter table public.ai_tutor_daily_usage enable row level security;

revoke all on table
  public.ai_tutor_conversations,
  public.ai_tutor_messages,
  public.student_saved_vocabulary,
  public.ai_tutor_daily_usage
from anon, authenticated;

grant select, insert, delete on public.ai_tutor_conversations to authenticated;
grant update (title) on public.ai_tutor_conversations to authenticated;
grant select, insert on public.ai_tutor_messages to authenticated;
grant select, insert, delete on public.student_saved_vocabulary to authenticated;

create policy "Students manage their own AI tutor conversations"
on public.ai_tutor_conversations
for all
to authenticated
using (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
)
with check (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
);

create policy "Students read their own AI tutor messages"
on public.ai_tutor_messages
for select
to authenticated
using (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
  and exists (
    select 1
    from public.ai_tutor_conversations as conversation
    where conversation.id = conversation_id
      and conversation.student_id = (select auth.uid())
  )
);

create policy "Students add messages to their own AI tutor conversations"
on public.ai_tutor_messages
for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
  and exists (
    select 1
    from public.ai_tutor_conversations as conversation
    where conversation.id = conversation_id
      and conversation.student_id = (select auth.uid())
  )
);

create policy "Students manage their own saved vocabulary"
on public.student_saved_vocabulary
for all
to authenticated
using (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
  and (
    source_conversation_id is null
    or exists (
      select 1
      from public.ai_tutor_conversations as conversation
      where conversation.id = source_conversation_id
        and conversation.student_id = (select auth.uid())
    )
  )
)
with check (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
  and (
    source_conversation_id is null
    or exists (
      select 1
      from public.ai_tutor_conversations as conversation
      where conversation.id = source_conversation_id
        and conversation.student_id = (select auth.uid())
    )
  )
);

create function public.consume_student_ai_tutor_quota()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_student_id uuid := (select auth.uid());
  current_utc_date date := (now() at time zone 'UTC')::date;
  quota_consumed boolean;
begin
  if current_student_id is null
    or not (select public.current_user_has_role(array['student'])) then
    raise insufficient_privilege using message = 'Student access is required.';
  end if;

  insert into public.ai_tutor_daily_usage as existing_usage (
    student_id,
    usage_date,
    request_count
  )
  values (current_student_id, current_utc_date, 1)
  on conflict (student_id) do update
  set usage_date = excluded.usage_date,
      request_count = case
        when existing_usage.usage_date = excluded.usage_date
          then existing_usage.request_count + 1
        else 1
      end
  where existing_usage.usage_date <> excluded.usage_date
    or existing_usage.request_count < 20
  returning true into quota_consumed;

  return coalesce(quota_consumed, false);
end;
$$;

revoke all on function public.consume_student_ai_tutor_quota() from public, anon;
grant execute on function public.consume_student_ai_tutor_quota() to authenticated;
