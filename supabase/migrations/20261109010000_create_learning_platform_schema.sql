create function public.is_valid_external_url(candidate text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select candidate ~*
  '^https?://(\[[0-9a-f:.]+\]|[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*)(:[0-9]{1,5})?([/?#][^[:space:]]*)?$';
$$;

create table public.course_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_url text check (
    image_url is null or public.is_valid_external_url(image_url)
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles (id) on delete restrict,
  category_id uuid references public.course_categories (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text check (
    short_description is null or char_length(short_description) <= 500
  ),
  description text,
  language text not null check (char_length(btrim(language)) between 2 and 80),
  difficulty text not null check (
    difficulty in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')
  ),
  thumbnail_url text check (
    thumbnail_url is null or public.is_valid_external_url(thumbnail_url)
  ),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  estimated_duration_minutes integer check (
    estimated_duration_minutes is null or estimated_duration_minutes > 0
  ),
  status text not null default 'DRAFT' check (
    status in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED')
  ),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, instructor_id),
  constraint courses_published_timestamp_check
    check (status <> 'PUBLISHED' or published_at is not null)
);

create index courses_instructor_status_idx
  on public.courses (instructor_id, status);
create index courses_category_status_idx
  on public.courses (category_id, status);
create index courses_published_created_idx
  on public.courses (published_at desc)
  where status = 'PUBLISHED';

create table public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position),
  unique (id, course_id)
);

create index course_sections_course_position_idx
  on public.course_sections (course_id, position);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text,
  content_type text not null check (
    content_type in ('VIDEO', 'AUDIO', 'TEXT', 'MIXED')
  ),
  content jsonb not null default '{}'::jsonb check (
    jsonb_typeof(content) = 'object'
  ),
  video_url text check (
    video_url is null or public.is_valid_external_url(video_url)
  ),
  audio_url text check (
    audio_url is null or public.is_valid_external_url(audio_url)
  ),
  video_storage_path text check (
    video_storage_path is null
    or (
      video_storage_path !~ '(^|/)\.\.?(/|$)'
      and video_storage_path !~ '^/'
    )
  ),
  audio_storage_path text check (
    audio_storage_path is null
    or (
      audio_storage_path !~ '(^|/)\.\.?(/|$)'
      and audio_storage_path !~ '^/'
    )
  ),
  duration_seconds integer check (
    duration_seconds is null or duration_seconds > 0
  ),
  position integer not null check (position >= 0),
  is_preview boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, position),
  constraint lessons_preview_published_check
    check (not is_preview or is_published),
  constraint lessons_video_source_check
    check (video_url is null or video_storage_path is null),
  constraint lessons_audio_source_check
    check (audio_url is null or audio_storage_path is null)
);

create index lessons_section_position_idx
  on public.lessons (section_id, position);
create index lessons_published_preview_idx
  on public.lessons (section_id, is_preview)
  where is_published;

alter table public.profiles
  add column avatar_path text,
  add constraint profiles_avatar_path_owner_check
    check (
      avatar_path is null
      or (
        split_part(avatar_path, '/', 1) = id::text
        and avatar_path !~ '(^|/)\.\.?(/|$)'
        and avatar_path !~ '^/'
      )
    );
grant update (avatar_path) on public.profiles to authenticated;

create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  resource_type text not null check (
    resource_type in ('DOCUMENT', 'AUDIO', 'VIDEO', 'LINK', 'OTHER')
  ),
  storage_path text check (
    storage_path is null
    or (
      storage_path !~ '(^|/)\.\.?(/|$)'
      and storage_path !~ '^/'
    )
  ),
  storage_bucket text not null default 'learning-resources' check (
    storage_bucket in ('learning-resources', 'lesson-media')
  ),
  external_url text check (
    external_url is null or public.is_valid_external_url(external_url)
  ),
  file_size_bytes bigint check (
    file_size_bytes is null or file_size_bytes > 0
  ),
  created_at timestamptz not null default now(),
  constraint lesson_resources_single_source_check
    check ((storage_path is not null) <> (external_url is not null))
);

create index lesson_resources_lesson_idx
  on public.lesson_resources (lesson_id);
create unique index lesson_resources_storage_path_idx
  on public.lesson_resources (storage_bucket, storage_path)
  where storage_path is not null;

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  status text not null default 'ACTIVE' check (
    status in ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')
  ),
  enrollment_type text not null check (
    enrollment_type in ('FREE', 'PAID', 'SUBSCRIPTION', 'ADMIN_GRANTED')
  ),
  enrolled_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, student_id),
  unique (id, student_id, course_id),
  check (expires_at is null or expires_at > enrolled_at)
);

create unique index enrollments_one_active_course_idx
  on public.enrollments (student_id, course_id)
  where status = 'ACTIVE';
create index enrollments_student_status_idx
  on public.enrollments (student_id, status, expires_at);
create index enrollments_course_status_idx
  on public.enrollments (course_id, status);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  lesson_id uuid not null references public.lessons (id) on delete restrict,
  status text not null default 'NOT_STARTED' check (
    status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')
  ),
  progress_percent integer not null default 0 check (
    progress_percent between 0 and 100
  ),
  last_position_seconds integer not null default 0 check (
    last_position_seconds >= 0
  ),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id),
  check (completed_at is null or completed_at >= started_at),
  constraint lesson_progress_completion_consistency_check check (
    (status = 'NOT_STARTED'
      and progress_percent = 0
      and last_position_seconds = 0
      and started_at is null
      and completed_at is null)
    or
    (status = 'IN_PROGRESS'
      and progress_percent < 100
      and started_at is not null
      and completed_at is null)
    or
    (status = 'COMPLETED'
      and progress_percent = 100
      and started_at is not null
      and completed_at is not null)
  )
);

create index lesson_progress_student_updated_idx
  on public.lesson_progress (student_id, updated_at desc);
create index lesson_progress_lesson_idx
  on public.lesson_progress (lesson_id);

create function public.validate_lesson_progress_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson_duration integer;
begin
  select lesson.duration_seconds
  into lesson_duration
  from public.lessons as lesson
  where lesson.id = new.lesson_id;

  if not found then
    raise foreign_key_violation using message = 'The progress lesson does not exist.';
  end if;

  if lesson_duration is not null
    and new.last_position_seconds > lesson_duration then
    raise check_violation using message = 'The lesson position exceeds its duration.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_lesson_progress_position() from public, anon, authenticated;

create trigger lesson_progress_validate_position
before insert or update on public.lesson_progress
for each row execute function public.validate_lesson_progress_position();

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  lesson_id uuid references public.lessons (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text,
  instructions text,
  time_limit_seconds integer check (
    time_limit_seconds is null or time_limit_seconds > 0
  ),
  passing_score numeric(5, 2) check (
    passing_score is null or passing_score between 0 and 100
  ),
  maximum_attempts integer check (
    maximum_attempts is null or maximum_attempts > 0
  ),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.validate_quiz_lesson_course()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lesson_id is not null and not exists (
    select 1
    from public.lessons as lesson
    join public.course_sections as section on section.id = lesson.section_id
    where lesson.id = new.lesson_id
      and section.course_id = new.course_id
  ) then
    raise foreign_key_violation using message = 'The quiz lesson must belong to its course.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_quiz_lesson_course() from public, anon, authenticated;

create trigger quizzes_validate_lesson_course
before insert or update on public.quizzes
for each row execute function public.validate_quiz_lesson_course();

create index quizzes_course_published_idx
  on public.quizzes (course_id, is_published);
create index quizzes_lesson_idx on public.quizzes (lesson_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete restrict,
  question_text text not null check (
    char_length(btrim(question_text)) between 1 and 10000
  ),
  question_type text not null check (
    question_type in (
      'SINGLE_CHOICE',
      'MULTIPLE_SELECT',
      'TRUE_FALSE',
      'FILL_IN_THE_BLANK'
    )
  ),
  explanation text,
  points numeric(7, 2) not null default 1 check (points > 0),
  position integer not null check (position >= 0),
  grading_mode text not null default 'AUTO' check (
    grading_mode in ('AUTO', 'MANUAL')
  ),
  answer_key text,
  created_at timestamptz not null default now(),
  unique (quiz_id, position),
  constraint quiz_question_grading_mode_check check (
    (question_type = 'FILL_IN_THE_BLANK' and grading_mode in ('AUTO', 'MANUAL'))
    or
    (question_type <> 'FILL_IN_THE_BLANK' and grading_mode = 'AUTO')
  ),
  constraint quiz_question_answer_key_check check (
    question_type <> 'FILL_IN_THE_BLANK'
    or grading_mode = 'MANUAL'
    or nullif(btrim(answer_key), '') is not null
  )
);

create index quiz_questions_quiz_position_idx
  on public.quiz_questions (quiz_id, position);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete restrict,
  option_text text not null check (
    char_length(btrim(option_text)) between 1 and 4000
  ),
  position integer not null check (position >= 0),
  is_correct boolean not null default false,
  unique (question_id, position)
);

create index question_options_question_idx
  on public.question_options (question_id, position);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  score numeric(9, 2),
  total_points numeric(9, 2) not null check (total_points >= 0),
  status text not null default 'IN_PROGRESS' check (
    status in ('IN_PROGRESS', 'PENDING_REVIEW', 'GRADED')
  ),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (quiz_id, student_id, attempt_number),
  constraint quiz_attempt_result_consistency_check check (
    (status = 'IN_PROGRESS' and score is null and submitted_at is null)
    or
    (status in ('PENDING_REVIEW', 'GRADED')
      and score is not null
      and score between 0 and total_points
      and submitted_at is not null)
  )
);

create index quiz_attempts_student_quiz_idx
  on public.quiz_attempts (student_id, quiz_id, created_at desc);
create index quiz_attempts_quiz_status_idx
  on public.quiz_attempts (quiz_id, status);

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete restrict,
  question_id uuid not null references public.quiz_questions (id) on delete restrict,
  selected_option_ids uuid[] not null default '{}',
  answer_text text,
  awarded_points numeric(7, 2),
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  check (cardinality(selected_option_ids) <= 100),
  check (awarded_points is null or awarded_points >= 0)
);

create index quiz_answers_attempt_idx on public.quiz_answers (attempt_id);
create index quiz_answers_question_idx on public.quiz_answers (question_id);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  billing_interval text not null check (
    billing_interval in ('DAY', 'WEEK', 'MONTH', 'YEAR', 'ONE_TIME')
  ),
  interval_count integer not null default 1 check (interval_count > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (billing_interval <> 'ONE_TIME' or interval_count = 1)
);

create index subscription_plans_active_idx
  on public.subscription_plans (is_active, price_cents);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  plan_id uuid not null references public.subscription_plans (id) on delete restrict,
  status text not null check (
    status in (
      'PENDING',
      'TRIALING',
      'ACTIVE',
      'PAST_DUE',
      'CANCELLED',
      'EXPIRED'
    )
  ),
  provider text not null check (
    provider in ('RAZORPAY', 'STRIPE', 'MANUAL')
  ),
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, student_id),
  check (
    current_period_end is null
    or current_period_start is null
    or current_period_end > current_period_start
  )
);

create unique index subscriptions_provider_id_idx
  on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index subscriptions_student_status_idx
  on public.subscriptions (student_id, status);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  enrollment_id uuid,
  subscription_id uuid,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null check (
    provider in ('RAZORPAY', 'STRIPE', 'MANUAL')
  ),
  provider_payment_id text,
  provider_order_id text,
  status text not null check (
    status in ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')
  ),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((enrollment_id is not null) <> (subscription_id is not null)),
  constraint payments_enrollment_owner_fkey
    foreign key (enrollment_id, student_id)
    references public.enrollments (id, student_id) on delete restrict,
  constraint payments_subscription_owner_fkey
    foreign key (subscription_id, student_id)
    references public.subscriptions (id, student_id) on delete restrict
);

create unique index payments_provider_payment_id_idx
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;
create unique index payments_provider_order_id_idx
  on public.payments (provider, provider_order_id)
  where provider_order_id is not null;
create index payments_student_created_idx
  on public.payments (student_id, created_at desc);
create index payments_enrollment_idx on public.payments (enrollment_id);
create index payments_subscription_idx on public.payments (subscription_id);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (
    provider in ('RAZORPAY', 'STRIPE', 'MANUAL')
  ),
  provider_event_id text not null check (
    char_length(btrim(provider_event_id)) between 1 and 255
  ),
  event_type text not null check (
    char_length(btrim(event_type)) between 1 and 160
  ),
  processing_status text not null default 'RECEIVED' check (
    processing_status in ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED')
  ),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index payment_events_status_created_idx
  on public.payment_events (processing_status, created_at);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  enrollment_id uuid not null unique references public.enrollments (id) on delete restrict,
  certificate_number text not null unique,
  verification_code text not null unique,
  issued_at timestamptz not null default now(),
  certificate_url text check (
    certificate_url is null
    or public.is_valid_external_url(certificate_url)
  ),
  certificate_storage_path text unique,
  status text not null default 'ISSUED' check (
    status in ('ISSUED', 'REVOKED')
  ),
  created_at timestamptz not null default now(),
  constraint certificates_enrollment_owner_fkey
    foreign key (enrollment_id, student_id, course_id)
    references public.enrollments (id, student_id, course_id) on delete restrict,
  check (
    certificate_storage_path is null
    or (
      split_part(certificate_storage_path, '/', 1) = student_id::text
      and split_part(certificate_storage_path, '/', 2) = id::text
      and certificate_storage_path !~ '(^|/)\.\.?(/|$)'
    )
  )
);

create index certificates_student_issued_idx
  on public.certificates (student_id, issued_at desc);
create index certificates_course_idx on public.certificates (course_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  message text not null check (char_length(btrim(message)) between 1 and 5000),
  notification_type text not null check (
    notification_type in (
      'SYSTEM',
      'COURSE',
      'ASSESSMENT',
      'BILLING',
      'LIVE_CLASS',
      'ACCOUNT'
    )
  ),
  target_url text check (
    target_url is null
    or (
      target_url ~ '^/'
      and target_url !~ '^//'
      and substr(target_url, 2, 1) not in ('/', chr(92))
      and target_url !~* '^/%(2f|5c)'
      and target_url !~ '[[:cntrl:]]'
    )
  ),
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check ((is_read and read_at is not null) or (not is_read and read_at is null))
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where not is_read;

create table public.live_classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  instructor_id uuid not null references public.profiles (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text,
  meeting_provider text not null check (
    meeting_provider in ('EXTERNAL', 'ZOOM', 'GOOGLE_MEET', 'OTHER')
  ),
  meeting_reference text not null check (
    char_length(btrim(meeting_reference)) between 1 and 2048
  ),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status text not null default 'SCHEDULED' check (
    status in ('SCHEDULED', 'CANCELLED', 'COMPLETED')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_classes_instructor_course_fkey
    foreign key (course_id, instructor_id)
    references public.courses (id, instructor_id) on delete restrict,
  check (scheduled_end > scheduled_start)
);

create index live_classes_course_start_idx
  on public.live_classes (course_id, scheduled_start);
create index live_classes_instructor_start_idx
  on public.live_classes (instructor_id, scheduled_start);

create table public.live_class_registrations (
  id uuid primary key default gen_random_uuid(),
  live_class_id uuid not null references public.live_classes (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  registration_status text not null default 'REGISTERED' check (
    registration_status in ('REGISTERED', 'CANCELLED', 'ATTENDED', 'NO_SHOW')
  ),
  registered_at timestamptz not null default now(),
  unique (live_class_id, student_id)
);

create index live_class_registrations_student_idx
  on public.live_class_registrations (student_id, registered_at desc);

create table public.platform_settings (
  setting_key text primary key check (
    setting_key ~ '^[a-z][a-z0-9_.-]{1,99}$'
    and setting_key !~*
      '(^|[_.-])(api.?key|access.?key|secret|token|password|credential|dsn|connection.?string)([_.-]|$)'
  ),
  setting_value jsonb not null check (
    jsonb_typeof(setting_value) in ('object', 'array', 'string', 'number', 'boolean', 'null')
  ),
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger course_categories_set_updated_at
before update on public.course_categories
for each row execute function public.set_updated_at();

create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

create trigger course_sections_set_updated_at
before update on public.course_sections
for each row execute function public.set_updated_at();

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function public.set_updated_at();

create trigger lesson_progress_set_updated_at
before update on public.lesson_progress
for each row execute function public.set_updated_at();

create trigger quizzes_set_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();

create trigger subscription_plans_set_updated_at
before update on public.subscription_plans
for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger live_classes_set_updated_at
before update on public.live_classes
for each row execute function public.set_updated_at();

create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

create function public.current_user_has_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = any(required_roles)
  );
$$;

create function public.can_manage_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses as course
    join public.profiles as actor on actor.id = (select auth.uid())
    where course.id = target_course_id
      and (
        actor.role = 'admin'
        or (
          actor.role = 'instructor'
          and course.instructor_id = actor.id
        )
      )
  );
$$;

create function public.can_access_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses as course
    join public.profiles as actor on actor.id = (select auth.uid())
    where course.id = target_course_id
      and (
        actor.role = 'admin'
        or (
          actor.role = 'instructor'
          and course.instructor_id = actor.id
        )
        or (
          actor.role = 'student'
          and course.status in ('PUBLISHED', 'ARCHIVED')
          and exists (
            select 1
            from public.enrollments as enrollment
            where enrollment.course_id = course.id
              and enrollment.student_id = actor.id
              and enrollment.status in ('ACTIVE', 'COMPLETED')
              and (
                enrollment.expires_at is null
                or enrollment.expires_at > now()
              )
          )
        )
      )
  );
$$;

create function public.can_manage_lesson(target_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons as lesson
    join public.course_sections as section on section.id = lesson.section_id
    where lesson.id = target_lesson_id
      and public.can_manage_course(section.course_id)
  );
$$;

create function public.can_access_lesson(target_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons as lesson
    join public.course_sections as section on section.id = lesson.section_id
    join public.courses as course on course.id = section.course_id
    where lesson.id = target_lesson_id
      and (
        public.can_manage_course(course.id)
        or (
          lesson.is_published
          and public.can_access_course(course.id)
        )
        or (
          lesson.is_published
          and lesson.is_preview
          and course.status = 'PUBLISHED'
        )
      )
  );
$$;

create function public.can_access_quiz(target_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quizzes as quiz
    where quiz.id = target_quiz_id
      and (
        public.can_manage_course(quiz.course_id)
        or (
          quiz.is_published
          and public.can_access_course(quiz.course_id)
        )
      )
  );
$$;

create function public.can_manage_live_class(target_live_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.live_classes as live_class
    join public.profiles as actor on actor.id = (select auth.uid())
    where live_class.id = target_live_class_id
      and (
        actor.role = 'admin'
        or (
          actor.role = 'instructor'
          and live_class.instructor_id = actor.id
          and public.can_manage_course(live_class.course_id)
        )
      )
  );
$$;

create function public.can_access_live_class(target_live_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.live_classes as live_class
    where live_class.id = target_live_class_id
      and (
        public.can_manage_live_class(live_class.id)
        or exists (
          select 1
          from public.live_class_registrations as registration
          join public.enrollments as enrollment
            on enrollment.course_id = live_class.course_id
           and enrollment.student_id = registration.student_id
          where registration.live_class_id = live_class.id
            and registration.student_id = (select auth.uid())
            and registration.registration_status = 'REGISTERED'
            and enrollment.status in ('ACTIVE', 'COMPLETED')
            and (
              enrollment.expires_at is null
              or enrollment.expires_at > now()
            )
        )
      )
  );
$$;

create function public.can_enroll_free_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses as course
    join public.profiles as actor on actor.id = (select auth.uid())
    where course.id = target_course_id
      and actor.role = 'student'
      and course.status = 'PUBLISHED'
      and course.price_cents = 0
  );
$$;

create function public.storage_can_manage_course(path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(path, '/', 1) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.can_manage_course(split_part(path, '/', 1)::uuid)
    else false
  end;
$$;

create function public.storage_can_access_lesson(path text, bucket text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  course_segment text := split_part(path, '/', 1);
  lesson_segment text := split_part(path, '/', 2);
begin
  if course_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or lesson_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  if bucket = 'lesson-media' then
    return exists (
      select 1
      from public.lessons as lesson
      join public.course_sections as section on section.id = lesson.section_id
      where lesson.id = lesson_segment::uuid
        and section.course_id = course_segment::uuid
        and public.can_access_lesson(lesson.id)
        and (
          lesson.video_storage_path = path
          or lesson.audio_storage_path = path
        )
    );
  end if;

  if bucket = 'learning-resources' then
    return exists (
      select 1
      from public.lesson_resources as resource
      join public.lessons as lesson on lesson.id = resource.lesson_id
      join public.course_sections as section on section.id = lesson.section_id
      where resource.storage_bucket = bucket
        and resource.storage_path = path
        and section.course_id = course_segment::uuid
        and lesson.id = lesson_segment::uuid
        and public.can_access_course(section.course_id)
    );
  end if;

  return false;
end;
$$;

create function public.storage_can_manage_lesson(path text, bucket text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  course_segment text := split_part(path, '/', 1);
  lesson_segment text := split_part(path, '/', 2);
begin
  if course_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or lesson_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  if bucket = 'lesson-media' then
    return exists (
      select 1
      from public.lessons as lesson
      join public.course_sections as section on section.id = lesson.section_id
      where lesson.id = lesson_segment::uuid
        and section.course_id = course_segment::uuid
        and public.can_manage_course(section.course_id)
        and (
          lesson.video_storage_path = path
          or lesson.audio_storage_path = path
        )
    );
  end if;

  if bucket = 'learning-resources' then
    return exists (
      select 1
      from public.lesson_resources as resource
      join public.lessons as lesson on lesson.id = resource.lesson_id
      join public.course_sections as section on section.id = lesson.section_id
      where resource.storage_bucket = bucket
        and resource.storage_path = path
        and section.course_id = course_segment::uuid
        and lesson.id = lesson_segment::uuid
        and public.can_manage_course(section.course_id)
    );
  end if;

  return false;
end;
$$;

create function public.storage_can_access_certificate(path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  student_segment text := split_part(path, '/', 1);
  certificate_segment text := split_part(path, '/', 2);
begin
  if student_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or certificate_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  return exists (
    select 1
    from public.certificates as certificate
    where certificate.student_id = student_segment::uuid
      and certificate.id = certificate_segment::uuid
      and certificate.status = 'ISSUED'
      and (
        certificate.student_id = (select auth.uid())
        or public.can_manage_course(certificate.course_id)
      )
  );
end;
$$;

create function public.storage_can_manage_certificate(path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  student_segment text := split_part(path, '/', 1);
  certificate_segment text := split_part(path, '/', 2);
begin
  if student_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or certificate_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  return exists (
    select 1
    from public.certificates as certificate
    where certificate.student_id = student_segment::uuid
      and certificate.id = certificate_segment::uuid
      and public.can_manage_course(certificate.course_id)
  );
end;
$$;

revoke all on function public.current_user_has_role(text[]) from public, anon;
revoke all on function public.can_manage_course(uuid) from public, anon;
revoke all on function public.can_access_course(uuid) from public, anon;
revoke all on function public.can_manage_lesson(uuid) from public, anon;
revoke all on function public.can_access_lesson(uuid) from public, anon;
revoke all on function public.can_access_quiz(uuid) from public, anon;
revoke all on function public.can_manage_live_class(uuid) from public, anon;
revoke all on function public.can_access_live_class(uuid) from public, anon;
revoke all on function public.can_enroll_free_course(uuid) from public, anon;
revoke all on function public.storage_can_manage_course(text) from public, anon;
revoke all on function public.storage_can_access_lesson(text, text) from public, anon;
revoke all on function public.storage_can_manage_lesson(text, text) from public, anon;
revoke all on function public.storage_can_access_certificate(text) from public, anon;
revoke all on function public.storage_can_manage_certificate(text) from public, anon;

grant execute on function public.current_user_has_role(text[]) to authenticated;
grant execute on function public.can_manage_course(uuid) to authenticated;
grant execute on function public.can_access_course(uuid) to authenticated;
grant execute on function public.can_manage_lesson(uuid) to authenticated;
grant execute on function public.can_access_lesson(uuid) to authenticated;
grant execute on function public.can_access_quiz(uuid) to authenticated;
grant execute on function public.can_manage_live_class(uuid) to authenticated;
grant execute on function public.can_access_live_class(uuid) to authenticated;
grant execute on function public.can_enroll_free_course(uuid) to authenticated;
grant execute on function public.storage_can_manage_course(text) to authenticated;
grant execute on function public.storage_can_access_lesson(text, text) to authenticated;
grant execute on function public.storage_can_manage_lesson(text, text) to authenticated;
grant execute on function public.storage_can_access_certificate(text) to authenticated;
grant execute on function public.storage_can_manage_certificate(text) to authenticated;

alter table public.course_categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_sections enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.question_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;
alter table public.live_classes enable row level security;
alter table public.live_class_registrations enable row level security;
alter table public.platform_settings enable row level security;

grant select on public.course_categories to anon, authenticated;
grant insert, update, delete on public.course_categories to authenticated;
grant select on public.courses to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.course_sections to authenticated;
grant select, insert, update, delete on public.lessons to authenticated;
grant select, insert, update, delete on public.lesson_resources to authenticated;
grant select, insert on public.enrollments to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;
grant select (
  id,
  quiz_id,
  question_text,
  question_type,
  points,
  position,
  created_at
) on public.quiz_questions to authenticated;
grant insert, update, delete on public.quiz_questions to authenticated;
grant select (id, question_id, option_text, position)
  on public.question_options to authenticated;
grant insert (question_id, option_text, position, is_correct),
  update (option_text, position, is_correct),
  delete on public.question_options to authenticated;
grant select on public.quiz_attempts to authenticated;
grant select on public.quiz_answers to authenticated;
grant insert (attempt_id, question_id, selected_option_ids, answer_text)
  on public.quiz_answers to authenticated;
grant update (selected_option_ids, answer_text)
  on public.quiz_answers to authenticated;
grant select on public.subscription_plans to anon, authenticated;
grant insert, update, delete on public.subscription_plans to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.payments to authenticated;
grant select on public.payment_events to authenticated;
grant select on public.certificates to authenticated;
grant select on public.notifications to authenticated;
grant update (is_read, read_at) on public.notifications to authenticated;
grant select (
  id,
  course_id,
  instructor_id,
  title,
  description,
  meeting_provider,
  scheduled_start,
  scheduled_end,
  status,
  created_at,
  updated_at
) on public.live_classes to authenticated;
grant insert (
  course_id,
  instructor_id,
  title,
  description,
  meeting_provider,
  meeting_reference,
  scheduled_start,
  scheduled_end,
  status
) on public.live_classes to authenticated;
grant update (
  course_id,
  instructor_id,
  title,
  description,
  meeting_provider,
  meeting_reference,
  scheduled_start,
  scheduled_end,
  status
) on public.live_classes to authenticated;
grant delete on public.live_classes to authenticated;
grant select on public.live_class_registrations to authenticated;
grant insert on public.live_class_registrations to authenticated;
grant select on public.platform_settings to anon, authenticated;
grant insert, update, delete on public.platform_settings to authenticated;

create policy "Public can read active categories"
on public.course_categories for select to anon, authenticated
using (is_active);

create policy "Administrators manage course categories"
on public.course_categories for all to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

create policy "Public can read published courses"
on public.courses for select to anon
using (status = 'PUBLISHED');

create policy "Authorized users can read courses"
on public.courses for select to authenticated
using (
  (select public.can_manage_course(id))
  or (select public.can_access_course(id))
);

create policy "Instructors create draft courses"
on public.courses for insert to authenticated
with check (
  instructor_id = (select auth.uid())
  and (select public.current_user_has_role(array['instructor']))
  and status = 'DRAFT'
  and published_at is null
);

create policy "Instructors update courses awaiting review"
on public.courses for update to authenticated
using (
  instructor_id = (select auth.uid())
  and (select public.current_user_has_role(array['instructor']))
  and status in ('DRAFT', 'PENDING_REVIEW')
)
with check (
  instructor_id = (select auth.uid())
  and (select public.current_user_has_role(array['instructor']))
  and status in ('DRAFT', 'PENDING_REVIEW')
  and published_at is null
);

create policy "Administrators manage all courses"
on public.courses for all to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

create policy "Authorized users read course sections"
on public.course_sections for select to authenticated
using (
  (select public.can_access_course(course_id))
  or exists (
    select 1
    from public.courses as course
    where course.id = course_sections.course_id
      and course.status = 'PUBLISHED'
      and exists (
        select 1
        from public.lessons as lesson
        where lesson.section_id = course_sections.id
          and lesson.is_published
          and lesson.is_preview
      )
  )
);

create policy "Course managers manage sections"
on public.course_sections for all to authenticated
using ((select public.can_manage_course(course_id)))
with check ((select public.can_manage_course(course_id)));

create policy "Authorized users read published lessons"
on public.lessons for select to authenticated
using ((select public.can_access_lesson(id)));

create policy "Course managers manage lessons"
on public.lessons for all to authenticated
using ((select public.can_manage_lesson(id)))
with check (
  exists (
    select 1
    from public.course_sections as section
    where section.id = lessons.section_id
      and (select public.can_manage_course(section.course_id))
  )
);

create policy "Authorized users read lesson resources"
on public.lesson_resources for select to authenticated
using (
  exists (
    select 1
    from public.lessons as lesson
    join public.course_sections as section on section.id = lesson.section_id
    where lesson.id = lesson_resources.lesson_id
      and (select public.can_access_course(section.course_id))
  )
);

create policy "Course managers manage lesson resources"
on public.lesson_resources for all to authenticated
using ((select public.can_manage_lesson(lesson_id)))
with check ((select public.can_manage_lesson(lesson_id)));

create policy "Students read their enrollments"
on public.enrollments for select to authenticated
using (
  student_id = (select auth.uid())
  or (select public.current_user_is_admin())
  or (select public.can_manage_course(course_id))
);

create policy "Students enroll in published free courses"
on public.enrollments for insert to authenticated
with check (
  student_id = (select auth.uid())
  and enrollment_type = 'FREE'
  and status = 'ACTIVE'
  and expires_at is null
  and (select public.can_enroll_free_course(course_id))
);

create policy "Students read their own progress"
on public.lesson_progress for select to authenticated
using (
  student_id = (select auth.uid())
  or (select public.current_user_is_admin())
  or exists (
    select 1
    from public.lessons as lesson
    join public.course_sections as section on section.id = lesson.section_id
    where lesson.id = lesson_progress.lesson_id
      and (select public.can_manage_course(section.course_id))
  )
);

create policy "Students create progress for accessible lessons"
on public.lesson_progress for insert to authenticated
with check (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
  and (select public.can_access_lesson(lesson_id))
);

create policy "Students update their own accessible progress"
on public.lesson_progress for update to authenticated
using (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
)
with check (
  student_id = (select auth.uid())
  and (select public.current_user_has_role(array['student']))
  and (select public.can_access_lesson(lesson_id))
);

create policy "Authorized users read published quizzes"
on public.quizzes for select to authenticated
using ((select public.can_access_quiz(id)));

create policy "Course managers manage quizzes"
on public.quizzes for all to authenticated
using ((select public.can_manage_course(course_id)))
with check (
  (select public.can_manage_course(course_id))
  and (
    lesson_id is null
    or exists (
      select 1
      from public.lessons as lesson
      join public.course_sections as section on section.id = lesson.section_id
      where lesson.id = quizzes.lesson_id
        and section.course_id = quizzes.course_id
    )
  )
);

create policy "Authorized users read quiz questions"
on public.quiz_questions for select to authenticated
using ((select public.can_access_quiz(quiz_id)));

create policy "Course managers manage quiz questions"
on public.quiz_questions for all to authenticated
using (
  exists (
    select 1
    from public.quizzes as quiz
    where quiz.id = quiz_questions.quiz_id
      and (select public.can_manage_course(quiz.course_id))
  )
)
with check (
  exists (
    select 1
    from public.quizzes as quiz
    where quiz.id = quiz_questions.quiz_id
      and (select public.can_manage_course(quiz.course_id))
  )
);

create policy "Authorized users read non-answer quiz options"
on public.question_options for select to authenticated
using (
  exists (
    select 1
    from public.quiz_questions as question
    where question.id = question_options.question_id
      and (select public.can_access_quiz(question.quiz_id))
  )
);

create policy "Course managers manage quiz options"
on public.question_options for all to authenticated
using (
  exists (
    select 1
    from public.quiz_questions as question
    join public.quizzes as quiz on quiz.id = question.quiz_id
    where question.id = question_options.question_id
      and (select public.can_manage_course(quiz.course_id))
  )
)
with check (
  exists (
    select 1
    from public.quiz_questions as question
    join public.quizzes as quiz on quiz.id = question.quiz_id
    where question.id = question_options.question_id
      and (select public.can_manage_course(quiz.course_id))
  )
);

create policy "Students read their own attempts"
on public.quiz_attempts for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1
    from public.quizzes as quiz
    where quiz.id = quiz_attempts.quiz_id
      and (select public.can_manage_course(quiz.course_id))
  )
);

create policy "Students read their own answers"
on public.quiz_answers for select to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts as attempt
    where attempt.id = quiz_answers.attempt_id
      and (
        attempt.student_id = (select auth.uid())
        or exists (
          select 1
          from public.quizzes as quiz
          where quiz.id = attempt.quiz_id
            and (select public.can_manage_course(quiz.course_id))
        )
      )
  )
);

create policy "Students write answers to their own active attempts"
on public.quiz_answers for all to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts as attempt
    where attempt.id = quiz_answers.attempt_id
      and attempt.student_id = (select auth.uid())
      and attempt.status = 'IN_PROGRESS'
  )
)
with check (
  exists (
    select 1
    from public.quiz_attempts as attempt
    join public.quiz_questions as question
      on question.quiz_id = attempt.quiz_id
     and question.id = quiz_answers.question_id
    where attempt.id = quiz_answers.attempt_id
      and attempt.student_id = (select auth.uid())
      and attempt.status = 'IN_PROGRESS'
  )
);

create policy "Public can read active subscription plans"
on public.subscription_plans for select to anon, authenticated
using (is_active);

create policy "Administrators manage subscription plans"
on public.subscription_plans for all to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

create policy "Users read their own subscriptions"
on public.subscriptions for select to authenticated
using (
  student_id = (select auth.uid())
  or (select public.current_user_is_admin())
);

create policy "Users read their own payments"
on public.payments for select to authenticated
using (
  student_id = (select auth.uid())
  or (select public.current_user_is_admin())
);

create policy "Administrators read payment events"
on public.payment_events for select to authenticated
using ((select public.current_user_is_admin()));

create policy "Students and course managers read certificates"
on public.certificates for select to authenticated
using (
  student_id = (select auth.uid())
  or (select public.current_user_is_admin())
  or (select public.can_manage_course(course_id))
);

create policy "Users read their own notifications"
on public.notifications for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.current_user_is_admin())
);

create policy "Users update only their own notification read state"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Authorized users read live class details"
on public.live_classes for select to authenticated
using ((select public.can_access_live_class(id)));

create policy "Instructors manage their own live classes"
on public.live_classes for all to authenticated
using ((select public.can_manage_live_class(id)))
with check (
  (select public.current_user_is_admin())
  or (
    instructor_id = (select auth.uid())
    and (select public.current_user_has_role(array['instructor']))
    and (select public.can_manage_course(course_id))
  )
);

create policy "Students read their own live class registrations"
on public.live_class_registrations for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1
    from public.live_classes as live_class
    where live_class.id = live_class_registrations.live_class_id
      and (select public.can_manage_live_class(live_class.id))
  )
  or (select public.current_user_is_admin())
);

create policy "Eligible students register for live classes"
on public.live_class_registrations for insert to authenticated
with check (
  student_id = (select auth.uid())
  and registration_status = 'REGISTERED'
  and (select public.current_user_has_role(array['student']))
  and exists (
    select 1
    from public.live_classes as live_class
    where live_class.id = live_class_registrations.live_class_id
      and live_class.status = 'SCHEDULED'
      and live_class.scheduled_start > now()
      and (select public.can_access_course(live_class.course_id))
  )
);

create policy "Anyone reads public platform settings"
on public.platform_settings for select to anon
using (is_public);

create policy "Authenticated users read public platform settings"
on public.platform_settings for select to authenticated
using (is_public or (select public.current_user_is_admin()));

create policy "Administrators manage platform settings"
on public.platform_settings for all to authenticated
using ((select public.current_user_is_admin()))
with check (
  (select public.current_user_is_admin())
  and (
    setting_key !~*
      '(^|[_.-])(api.?key|access.?key|secret|token|password|credential|dsn|connection.?string)([_.-]|$)'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'course-thumbnails',
    'course-thumbnails',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'lesson-media',
    'lesson-media',
    false,
    52428800,
    array[
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/mp4',
      'audio/ogg',
      'audio/wav',
      'audio/webm'
    ]
  ),
  (
    'learning-resources',
    'learning-resources',
    false,
    26214400,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'audio/mpeg',
      'audio/mp4',
      'audio/ogg',
      'audio/wav'
    ]
  ),
  (
    'user-avatars',
    'user-avatars',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'certificates',
    'certificates',
    false,
    10485760,
    array['application/pdf']
  )
on conflict (id) do nothing;

drop policy if exists "Public can read course thumbnails" on storage.objects;
create policy "Public can read course thumbnails"
on storage.objects for select to public
using (bucket_id = 'course-thumbnails');

drop policy if exists "Course managers upload thumbnails" on storage.objects;
create policy "Course managers upload thumbnails"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-thumbnails'
  and (select public.storage_can_manage_course(name))
);

drop policy if exists "Course managers update thumbnails" on storage.objects;
create policy "Course managers update thumbnails"
on storage.objects for update to authenticated
using (
  bucket_id = 'course-thumbnails'
  and (select public.storage_can_manage_course(name))
)
with check (
  bucket_id = 'course-thumbnails'
  and (select public.storage_can_manage_course(name))
);

drop policy if exists "Course managers delete thumbnails" on storage.objects;
create policy "Course managers delete thumbnails"
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-thumbnails'
  and (select public.storage_can_manage_course(name))
);

drop policy if exists "Authorized users read lesson media" on storage.objects;
create policy "Authorized users read lesson media"
on storage.objects for select to authenticated
using (
  bucket_id = 'lesson-media'
  and (select public.storage_can_access_lesson(name, bucket_id))
);

drop policy if exists "Course managers upload lesson media" on storage.objects;
create policy "Course managers upload lesson media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'lesson-media'
  and (select public.storage_can_manage_lesson(name, bucket_id))
);

drop policy if exists "Course managers update lesson media" on storage.objects;
create policy "Course managers update lesson media"
on storage.objects for update to authenticated
using (
  bucket_id = 'lesson-media'
  and (select public.storage_can_manage_lesson(name, bucket_id))
)
with check (
  bucket_id = 'lesson-media'
  and (select public.storage_can_manage_lesson(name, bucket_id))
);

drop policy if exists "Course managers delete lesson media" on storage.objects;
create policy "Course managers delete lesson media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'lesson-media'
  and (select public.storage_can_manage_lesson(name, bucket_id))
);

drop policy if exists "Enrolled users read learning resources" on storage.objects;
create policy "Enrolled users read learning resources"
on storage.objects for select to authenticated
using (
  bucket_id = 'learning-resources'
  and (select public.storage_can_access_lesson(name, bucket_id))
);

drop policy if exists "Course managers upload learning resources" on storage.objects;
create policy "Course managers upload learning resources"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'learning-resources'
  and (select public.storage_can_manage_lesson(name, bucket_id))
);

drop policy if exists "Course managers update learning resources" on storage.objects;
create policy "Course managers update learning resources"
on storage.objects for update to authenticated
using (
  bucket_id = 'learning-resources'
  and (select public.storage_can_manage_lesson(name, bucket_id))
)
with check (
  bucket_id = 'learning-resources'
  and (select public.storage_can_manage_lesson(name, bucket_id))
);

drop policy if exists "Course managers delete learning resources" on storage.objects;
create policy "Course managers delete learning resources"
on storage.objects for delete to authenticated
using (
  bucket_id = 'learning-resources'
  and (select public.storage_can_manage_lesson(name, bucket_id))
);

drop policy if exists "Users read own avatars" on storage.objects;
create policy "Users read own avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'user-avatars'
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or (select public.current_user_is_admin())
  )
);

drop policy if exists "Users upload own avatars" on storage.objects;
create policy "Users upload own avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'user-avatars'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "Users update own avatars" on storage.objects;
create policy "Users update own avatars"
on storage.objects for update to authenticated
using (
  bucket_id = 'user-avatars'
  and split_part(name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'user-avatars'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "Users delete own avatars" on storage.objects;
create policy "Users delete own avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'user-avatars'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "Authorized users read certificates" on storage.objects;
create policy "Authorized users read certificates"
on storage.objects for select to authenticated
using (
  bucket_id = 'certificates'
  and (select public.storage_can_access_certificate(name))
);

drop policy if exists "Course managers upload certificates" on storage.objects;
create policy "Course managers upload certificates"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'certificates'
  and (select public.storage_can_manage_certificate(name))
);

drop policy if exists "Course managers update certificates" on storage.objects;
create policy "Course managers update certificates"
on storage.objects for update to authenticated
using (
  bucket_id = 'certificates'
  and (select public.storage_can_manage_certificate(name))
)
with check (
  bucket_id = 'certificates'
  and (select public.storage_can_manage_certificate(name))
);

drop policy if exists "Course managers delete certificates" on storage.objects;
create policy "Course managers delete certificates"
on storage.objects for delete to authenticated
using (
  bucket_id = 'certificates'
  and (select public.storage_can_manage_certificate(name))
);
