create or replace function public.admin_unpublish_assessment(
  target_assessment_id uuid,
  moderation_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_instructor_id uuid;
  target_title text;
begin
  if (select auth.uid()) is null
    or not (select public.current_user_is_admin()) then
    raise insufficient_privilege using message = 'Administrator access is required.';
  end if;
  if char_length(btrim(coalesce(moderation_reason, ''))) not between 3 and 1000 then
    raise check_violation using message = 'Provide a moderation reason.';
  end if;

  select course.instructor_id, quiz.title
  into target_instructor_id, target_title
  from public.quizzes as quiz
  join public.courses as course on course.id = quiz.course_id
  where quiz.id = target_assessment_id
  for update;
  if not found then
    raise no_data_found using message = 'The selected assessment does not exist.';
  end if;

  perform set_config('app.admin_action_reason', btrim(moderation_reason), true);
  update public.quizzes
  set is_published = false
  where id = target_assessment_id
    and is_published;
  if not found then
    raise check_violation using message = 'The assessment is already unpublished.';
  end if;

  perform public.create_admin_notification(
    target_instructor_id,
    'Assessment moderation decision',
    'An administrator unpublished "' || target_title || '". Reason: ' || btrim(moderation_reason),
    'ASSESSMENT',
    '/instructor/assessments'
  );
end;
$$;
