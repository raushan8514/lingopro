create index courses_published_search_idx
  on public.courses using gin (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' '
      || coalesce(short_description, '') || ' '
      || coalesce(description, '') || ' '
      || coalesce(language, '')
    )
  )
  where status = 'PUBLISHED';

create index course_categories_active_search_idx
  on public.course_categories using gin (to_tsvector('simple', name))
  where is_active;

create function public.search_published_courses(
  p_search_term text default null,
  p_language text default null,
  p_difficulty text default null,
  p_price text default 'all',
  p_category_id uuid default null,
  p_sort text default 'newest',
  p_limit integer default 12,
  p_offset integer default 0,
  p_instructor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  search_query tsquery;
  response jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 48
    or p_offset is null or p_offset < 0 or p_offset > 10000 then
    raise invalid_parameter_value using message = 'Invalid marketplace pagination.';
  end if;

  if p_sort is null or p_sort not in (
    'newest',
    'alphabetical',
    'price-asc',
    'price-desc'
  ) then
    raise invalid_parameter_value using message = 'Invalid marketplace sort order.';
  end if;

  if p_price is null or p_price not in ('all', 'free', 'paid') then
    raise invalid_parameter_value using message = 'Invalid marketplace price filter.';
  end if;

  if p_difficulty is not null and p_difficulty not in (
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED'
  ) then
    raise invalid_parameter_value using message = 'Invalid marketplace difficulty filter.';
  end if;

  if p_search_term is not null and char_length(btrim(p_search_term)) > 100 then
    raise invalid_parameter_value using message = 'Marketplace search is limited to 100 characters.';
  end if;

  if p_language is not null and char_length(btrim(p_language)) > 80 then
    raise invalid_parameter_value using message = 'Marketplace language filter is invalid.';
  end if;

  if nullif(btrim(p_search_term), '') is not null then
    search_query := websearch_to_tsquery('simple', btrim(p_search_term));
  end if;

  with public_courses as (
    select
      course.id,
      course.instructor_id,
      course.category_id,
      course.title,
      course.slug,
      course.short_description,
      course.description,
      course.language,
      course.difficulty,
      course.thumbnail_url,
      course.price_cents,
      course.currency,
      course.estimated_duration_minutes,
      course.published_at,
      category.name as category_name,
      category.slug as category_slug,
      instructor.full_name as instructor_name,
      instructor.avatar_url as instructor_avatar_url
    from public.courses as course
    left join public.course_categories as category
      on category.id = course.category_id
      and category.is_active
    left join public.profiles as instructor
      on instructor.id = course.instructor_id
      and instructor.role = 'instructor'
    where course.status = 'PUBLISHED'
  ),
  filtered_courses as (
    select course.*
    from public_courses as course
    where (
      search_query is null
      or to_tsvector(
        'simple',
        coalesce(course.title, '') || ' '
        || coalesce(course.short_description, '') || ' '
        || coalesce(course.description, '') || ' '
        || coalesce(course.language, '')
      ) @@ search_query
      or exists (
        select 1
        from public.course_categories as search_category
        where search_category.id = course.category_id
          and search_category.is_active
          and to_tsvector('simple', search_category.name) @@ search_query
      )
    )
      and (p_language is null or lower(course.language) = lower(p_language))
      and (p_difficulty is null or course.difficulty = p_difficulty)
      and (
        p_price = 'all'
        or (p_price = 'free' and course.price_cents = 0)
        or (p_price = 'paid' and course.price_cents > 0)
      )
      and (
        p_category_id is null
        or (
          course.category_id = p_category_id
          and exists (
            select 1
            from public.course_categories as filter_category
            where filter_category.id = course.category_id
              and filter_category.is_active
          )
        )
      )
      and (p_instructor_id is null or course.instructor_id = p_instructor_id)
  ),
  paged_courses as (
    select course.*
    from filtered_courses as course
    order by
      case when p_sort = 'newest' then course.published_at end desc nulls last,
      case when p_sort = 'alphabetical' then lower(course.title) end asc nulls last,
      case when p_sort = 'price-asc' then course.price_cents end asc nulls last,
      case when p_sort = 'price-desc' then course.price_cents end desc nulls last,
      course.id
    limit p_limit
    offset p_offset
  )
  select jsonb_build_object(
    'total',
    (select count(*) from filtered_courses),
    'courses',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', course.id,
            'instructor_id', course.instructor_id,
            'category_id', course.category_id,
            'title', course.title,
            'slug', course.slug,
            'short_description', course.short_description,
            'language', course.language,
            'difficulty', course.difficulty,
            'thumbnail_url', course.thumbnail_url,
            'price_cents', course.price_cents,
            'currency', course.currency,
            'estimated_duration_minutes', course.estimated_duration_minutes,
            'published_at', course.published_at,
            'category_name', course.category_name,
            'category_slug', course.category_slug,
            'instructor_name', course.instructor_name,
            'instructor_avatar_url', course.instructor_avatar_url
          )
          order by
            case when p_sort = 'newest' then course.published_at end desc nulls last,
            case when p_sort = 'alphabetical' then lower(course.title) end asc nulls last,
            case when p_sort = 'price-asc' then course.price_cents end asc nulls last,
            case when p_sort = 'price-desc' then course.price_cents end desc nulls last,
            course.id
        )
        from paged_courses as course
      ),
      '[]'::jsonb
    ),
    'languages',
    coalesce(
      (
        select jsonb_agg(language_values.language order by language_values.language)
        from (
          select distinct course.language
          from public.courses as course
          where course.status = 'PUBLISHED'
        ) as language_values
      ),
      '[]'::jsonb
    )
  )
  into response;

  return response;
end;
$$;

create function public.get_public_course_details(target_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', course.id,
    'instructor_id', course.instructor_id,
    'category_id', course.category_id,
    'title', course.title,
    'slug', course.slug,
    'short_description', course.short_description,
    'description', course.description,
    'language', course.language,
    'difficulty', course.difficulty,
    'thumbnail_url', course.thumbnail_url,
    'price_cents', course.price_cents,
    'currency', course.currency,
    'estimated_duration_minutes', course.estimated_duration_minutes,
    'published_at', course.published_at,
    'category_name', category.name,
    'category_slug', category.slug
  )
  from public.courses as course
  left join public.course_categories as category
    on category.id = course.category_id
    and category.is_active
  where course.slug = target_slug
    and course.status = 'PUBLISHED';
$$;

create function public.get_public_course_categories()
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  image_url text,
  course_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    category.id,
    category.name,
    category.slug,
    category.description,
    category.image_url,
    count(course.id)
  from public.course_categories as category
  join public.courses as course
    on course.category_id = category.id
    and course.status = 'PUBLISHED'
  where category.is_active
  group by category.id
  order by category.name;
$$;

create function public.get_public_instructor_profile(target_instructor_id uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.full_name, profile.avatar_url
  from public.profiles as profile
  where profile.id = target_instructor_id
    and profile.role = 'instructor'
    and exists (
      select 1
      from public.courses as course
      where course.instructor_id = profile.id
        and course.status = 'PUBLISHED'
    );
$$;

create function public.get_public_course_curriculum(target_course_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', section.id,
        'title', section.title,
        'position', section.position,
        'lessons',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', lesson.id,
                'title', lesson.title,
                'content_type', lesson.content_type,
                'duration_seconds', lesson.duration_seconds,
                'position', lesson.position,
                'is_preview', lesson.is_preview
              )
              order by lesson.position
            )
            from public.lessons as lesson
            where lesson.section_id = section.id
              and lesson.is_published
          ),
          '[]'::jsonb
        )
      )
      order by section.position
    ),
    '[]'::jsonb
  )
  from public.course_sections as section
  join public.courses as course on course.id = section.course_id
  where section.course_id = target_course_id
    and course.status = 'PUBLISHED';
$$;

revoke all on function public.search_published_courses(
  text, text, text, text, uuid, text, integer, integer, uuid
) from public;
revoke all on function public.get_public_course_details(text) from public;
revoke all on function public.get_public_course_categories() from public;
revoke all on function public.get_public_instructor_profile(uuid) from public;
revoke all on function public.get_public_course_curriculum(uuid) from public;

grant execute on function public.search_published_courses(
  text, text, text, text, uuid, text, integer, integer, uuid
) to anon, authenticated;
grant execute on function public.get_public_course_details(text)
  to anon, authenticated;
grant execute on function public.get_public_course_categories()
  to anon, authenticated;
grant execute on function public.get_public_instructor_profile(uuid)
  to anon, authenticated;
grant execute on function public.get_public_course_curriculum(uuid)
  to anon, authenticated;
