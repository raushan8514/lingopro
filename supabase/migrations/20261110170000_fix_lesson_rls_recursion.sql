create function public.can_manage_section(target_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_sections as section
    where section.id = target_section_id
      and public.can_manage_course(section.course_id)
  );
$$;

revoke all on function public.can_manage_section(uuid) from public, anon;
grant execute on function public.can_manage_section(uuid) to authenticated;

drop policy if exists "Course managers manage lessons" on public.lessons;
create policy "Course managers manage lessons"
on public.lessons for all to authenticated
using ((select public.can_manage_lesson(id)))
with check ((select public.can_manage_section(section_id)));
