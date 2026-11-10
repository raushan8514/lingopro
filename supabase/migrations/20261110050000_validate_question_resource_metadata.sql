grant select (difficulty, resource_links)
  on public.quiz_questions to authenticated;

create function public.validate_quiz_question_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(new.resource_links) is distinct from 'array'
    or jsonb_array_length(new.resource_links) > 5
    or exists (
      select 1
      from jsonb_array_elements(new.resource_links) as item(value)
      where jsonb_typeof(item.value) is distinct from 'object'
        or jsonb_typeof(item.value -> 'label') is distinct from 'string'
        or jsonb_typeof(item.value -> 'url') is distinct from 'string'
        or char_length(btrim(item.value ->> 'label')) not between 1 and 120
        or char_length(item.value ->> 'url') > 2048
        or (item.value ->> 'url') !~ '^https://[^/@[:space:]]+(/|[?]|#|$)'
    ) then
    raise check_violation using message = 'Question resources require a short label and a safe HTTPS URL.';
  end if;
  return new;
end;
$$;

create trigger quiz_questions_validate_metadata
before insert or update of difficulty, resource_links
on public.quiz_questions
for each row execute function public.validate_quiz_question_metadata();

revoke all on function public.validate_quiz_question_metadata()
  from public, anon, authenticated;
