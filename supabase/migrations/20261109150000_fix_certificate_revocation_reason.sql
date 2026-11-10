create or replace function public.revoke_course_certificate(
  target_certificate_id uuid,
  revocation_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  certificate_row record;
  normalized_reason text;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required.';
  end if;

  normalized_reason := btrim(coalesce(revocation_reason, ''));
  if char_length(normalized_reason) < 10
    or char_length(normalized_reason) > 1000 then
    raise check_violation using message = 'Provide a revocation reason of 10 to 1000 characters.';
  end if;

  select certificate.id, certificate.course_id, certificate.status
  into certificate_row
  from public.certificates as certificate
  where certificate.id = target_certificate_id
  for update;

  if not found
    or not (
      (select public.current_user_is_admin())
      or (select public.can_manage_course(certificate_row.course_id))
    ) then
    raise insufficient_privilege using message = 'Course manager access is required.';
  end if;

  if certificate_row.status <> 'ISSUED' then
    raise check_violation using message = 'Only an issued certificate can be revoked.';
  end if;

  update public.certificates
  set status = 'REVOKED',
      revoked_at = now(),
      revoked_by = (select auth.uid()),
      revocation_reason = normalized_reason
  where id = target_certificate_id;
end;
$$;

revoke all on function public.revoke_course_certificate(uuid, text) from public, anon;
grant execute on function public.revoke_course_certificate(uuid, text) to authenticated;
