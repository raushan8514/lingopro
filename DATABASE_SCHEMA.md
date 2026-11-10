# LingoPro Database Schema

This reference documents the additive Phase 5 through Phase 14 migrations:

- `20261109010000_create_learning_platform_schema.sql`
- `20261109020000_add_secure_learning_operations.sql`
- `20261109030000_add_marketplace_public_reads.sql`
- `20261109040000_add_student_learning_hub.sql`
- `20261109050000_add_lms_playback_and_completion.sql`
- `20261109060000_add_assessment_engine.sql`
- `20261109070000_add_instructor_workspace.sql`
- `20261109080000_add_instructor_question_editor.sql`
- `20261109090000_add_admin_workspace.sql`
- `20261109100000_add_razorpay_payment_lifecycle.sql`
- `20261109110000_subscription_plan_activation_and_payment_search.sql`
- `20261109120000_add_ai_language_tutor.sql`
- `20261109130000_add_phase_fourteen_workflows.sql`
- `20261109140000_harden_phase_fourteen_workflows.sql`
- `20261109150000_fix_certificate_revocation_reason.sql`
- `20261109160000_restrict_live_class_table_grants.sql`
- `20261110010000_assessment_certification_requirements.sql`
- `20261110020000_matching_assessment_questions.sql`
- `20261110030000_fix_certificate_eligibility_fields.sql`
- `20261110040000_question_bank_and_manual_assessment_review.sql`
- `20261110050000_validate_question_resource_metadata.sql`
- `20261110060000_course_authoring_and_publish_readiness.sql`
- `20261110070000_restrict_anon_learning_content_grants.sql`
- `20261110080000_harden_quiz_answer_access.sql`
- `20261110090000_restrict_direct_certificate_inserts.sql`
- `20261110100000_fix_course_readiness_and_reorder_guards.sql`
- `20261110110000_restrict_anon_learning_data_grants.sql`
- `20261110120000_remove_unused_admin_assessment_state.sql`
- `20261110170000_fix_lesson_rls_recursion.sql`
- `20261111010000_complete_assessment_authoring.sql`
- `20261111020000_automatic_certificate_issuance.sql`

The existing Phase 4 `profiles` table, role checks, authentication triggers,
and profile policies remain the source of identity. These migrations do not
recreate `auth.users`, modify an applied migration, delete records, or seed
production data. Test fixtures in `supabase/tests/learning_platform_rls.test.sql`
are transaction-scoped and rolled back.

## Conventions and relationship overview

- IDs are PostgreSQL UUIDs. Timestamps are `timestamptz` in UTC.
- Currency values are integer minor units with an uppercase three-letter
  currency code. No card numbers, CVVs, provider secrets, or webhook payloads
  are stored.
- Foreign keys use `RESTRICT` where deleting a parent could destroy learning
  or financial history. Content child records are not automatically deleted.
- `public.set_updated_at()` from Phase 4 is reused for tables with an
  `updated_at` column.
- Tables with personal, learning, assessment, billing, or operational data
  have RLS enabled. Public catalog access is limited to active categories,
  published course details, and active subscription-plan details.

Main relationships:

```text
profiles ──< courses >── course_categories
                 └──< course_sections ──< lessons ──< lesson_resources
                          │                    └──< lesson_progress
                          └──< quizzes ──< quiz_questions ──< question_options
                                      └──< quiz_attempts ──< quiz_answers
courses ──< question_bank_items ──< question_bank_options
quiz_attempts ──< assessment_attempt_review_events
profiles ──< enrollments >── courses
profiles ──< subscriptions >── subscription_plans
profiles ──< payments ──> enrollments or subscriptions
profiles ──< certificates >── courses and completed enrollments
profiles ──< notifications
profiles ── student_learning_goals
profiles ──< ai_tutor_conversations ──< ai_tutor_messages
profiles ──< student_saved_vocabulary
profiles ── ai_tutor_daily_usage
courses ──< live_classes ──< live_class_registrations >── profiles
```

## Identity and profiles

### `public.profiles` (Phase 4, extended)

The existing `id`, `full_name`, `email`, `avatar_url`, `role`,
`created_at`, and `updated_at` columns and Phase 4 policies are unchanged.
Phase 5 adds:

| Column | Type | Meaning and rules |
|---|---|---|
| `avatar_path` | `text`, nullable | Object path in the private `user-avatars` bucket. The first path segment must equal the profile UUID; path traversal and leading slashes are rejected. |

Users may update their own avatar path only. They cannot change `role` or
another user's profile. The profile FK to `auth.users` and Phase 4 admin
role-change RPC remain authoritative.

## Course management and learning content

### `public.course_categories`

| Column | Type | Meaning and rules |
|---|---|---|
| `id` | `uuid` | Primary key, generated UUID. |
| `name` | `text` | Required, trimmed length 1–100. |
| `slug` | `text` | Required unique lowercase URL slug. |
| `description` | `text` | Optional description. |
| `image_url` | `text` | Optional validated HTTP(S) URL. |
| `is_active` | `boolean` | Defaults true; inactive categories are hidden from public users. |
| `created_at`, `updated_at` | `timestamptz` | Creation and automatic update times. |

Index: unique `slug`. Admins manage category rows; public roles can read active
categories.

### `public.courses`

| Column | Type | Meaning and rules |
|---|---|---|
| `id` | `uuid` | Primary key. |
| `instructor_id` | `uuid` | FK to `profiles.id`, delete restricted. |
| `category_id` | `uuid` | Nullable FK to `course_categories.id`, set null on category deletion. |
| `title`, `slug` | `text` | Required; title length 1–180; slug unique and lowercase. |
| `short_description` | `text` | Optional, at most 500 characters. |
| `description` | `text` | Optional long description. |
| `language` | `text` | Required, trimmed length 2–80. |
| `difficulty` | `text` | `BEGINNER`, `INTERMEDIATE`, or `ADVANCED`. |
| `thumbnail_url` | `text` | Optional validated HTTP(S) URL. |
| `learning_outcomes` | `text[]` | Up to 20 outcomes, each trimmed to 1–300 characters. |
| `prerequisites`, `target_audience` | `text` | Optional course guidance, each at most 5,000 characters. |
| `price_cents` | `integer` | Nonnegative minor currency units; defaults to zero. |
| `currency` | `text` | Uppercase three-letter code; defaults to `USD`. |
| `estimated_duration_minutes` | `integer` | Optional positive duration. |
| `status` | `text` | `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, or `ARCHIVED`; defaults `DRAFT`. |
| `published_at` | `timestamptz` | Required whenever status is `PUBLISHED`. |
| `created_at`, `updated_at` | `timestamptz` | Creation and automatic update times. |

Indexes/constraints: unique `slug` and `(id, instructor_id)` for the live-class
ownership FK; `(instructor_id, status)`, `(category_id, status)`, and
published-course timestamp indexes. Instructors create their own drafts
and edit only drafts or courses pending review. Admins control publication.
New courses must be created as drafts. Publication is rejected unless the
course has at least one section, every section has a published lesson, and
each published lesson has valid media or reading content for its content
type. Published course information is public; an enrolled learner can retain
access to an archived course until the enrollment ends.

The instructor save action inserts the authenticated profile ID as
`instructor_id` without `RETURNING`, then separately reads the row by its
unique slug and owner to verify the persisted ID. This avoids applying the
SELECT policy to the row in the same INSERT statement. Updates similarly
require a returned owned course row. These checks do not bypass RLS.

### `public.course_sections`

| Column | Type | Meaning and rules |
|---|---|---|
| `id` | `uuid` | Primary key. |
| `course_id` | `uuid` | FK to `courses.id`, delete restricted. |
| `title` | `text` | Required, trimmed length 1–180. |
| `description` | `text` | Optional section description. |
| `position` | `integer` | Required nonnegative order within the course. |
| `created_at`, `updated_at` | `timestamptz` | Creation and automatic update times. |

Constraints: unique `(course_id, position)` and `(id, course_id)`.
Index: `(course_id, position)`. Course managers may manage sections; learners
see sections for accessible courses or sections containing an explicitly
published preview lesson.

### `public.lessons`

| Column | Type | Meaning and rules |
|---|---|---|
| `id` | `uuid` | Primary key. |
| `section_id` | `uuid` | FK to `course_sections.id`, delete restricted. |
| `title` | `text` | Required, trimmed length 1–180. |
| `description` | `text` | Optional description. |
| `content_type` | `text` | `VIDEO`, `AUDIO`, `TEXT`, or `MIXED`. |
| `content` | `jsonb` | Object-valued content; defaults to `{}`. |
| `video_url`, `audio_url` | `text` | Optional HTTP(S) external media URLs. |
| `video_storage_path`, `audio_storage_path` | `text` | Optional private `lesson-media` paths; mutually exclusive with the matching external URL. |
| `duration_seconds` | `integer` | Optional positive duration. |
| `position` | `integer` | Required nonnegative order within a section. |
| `is_preview` | `boolean` | Defaults false; may be true only for a published lesson. |
| `is_published` | `boolean` | Defaults false. Unpublished lessons are not learner-readable. |
| `created_at`, `updated_at` | `timestamptz` | Creation and automatic update times. |

Constraints: unique `(section_id, position)`, one source per media type, and
preview publication consistency. Indexes support section order and published
preview lookup. Managers control lesson content through RLS; the lesson write
policy uses the recursion-safe `can_manage_section` helper instead of querying
the section table under its preview-aware SELECT policy. Learners access
published lessons through enrollment or explicit preview settings.

### `public.lesson_resources`

| Column | Type | Meaning and rules |
|---|---|---|
| `id` | `uuid` | Primary key. |
| `lesson_id` | `uuid` | FK to `lessons.id`, delete restricted. |
| `title` | `text` | Required, trimmed length 1–180. |
| `resource_type` | `text` | `DOCUMENT`, `AUDIO`, `VIDEO`, `LINK`, or `OTHER`. |
| `storage_path` | `text` | Optional private object path, without path traversal. |
| `storage_bucket` | `text` | `learning-resources` or `lesson-media`; defaults to `learning-resources`. |
| `external_url` | `text` | Optional HTTP(S) link. |
| `file_size_bytes` | `bigint` | Optional positive file size. |
| `created_at` | `timestamptz` | Creation time. |

Exactly one of `storage_path` and `external_url` is required. Storage paths
are unique per bucket. Managers control resources; private resource objects
are available only to learners with course access (previews do not expose
downloadable resource records). Phase 8 additionally requires the lesson to
be published before an enrolled learner can enumerate its resource records
or authorize their Storage objects.

## Instructor authoring operations (Phase 10)

The Phase 10 migrations add no application tables. The workspace reuses the
course, curriculum, roster, progress, and assessment records described above.

`reorder_course_sections` and `reorder_section_lessons` defer their respective
unique position constraints for the duration of a reordering transaction.
They require course-manager access and reject duplicate, foreign, omitted, or
otherwise incomplete ID arrays; accepted arrays must contain each existing
child in the target course or section exactly once.

`save_instructor_quiz_question` requires an owned course and unpublished
assessment, locks the assessment row to serialize with attempt creation, and
rejects edits after any attempt exists. Question fields and option replacement
run in one transaction so an option write failure cannot leave stale or
partially replaced choices. It validates question type, points, accepted
answer bounds, option counts, and correct-choice counts.

The manager-only `get_quiz_answer_key` projection also returns accepted
fill-in answers and their matching sensitivity/whitespace settings for
instructor editing. Student table grants remain unchanged and do not expose
these fields. `supabase/tests/instructor_workspace.test.sql` covers ownership,
ordering validation, option replacement, publication state, and
post-attempt immutability.

## Enrollment and progress

### `public.enrollments`

| Column | Type | Meaning and rules |
|---|---|---|
| `id` | `uuid` | Primary key. |
| `student_id` | `uuid` | FK to `profiles.id`, delete restricted. |
| `course_id` | `uuid` | FK to `courses.id`, delete restricted. |
| `status` | `text` | `ACTIVE`, `COMPLETED`, `CANCELLED`, or `EXPIRED`; defaults `ACTIVE`. |
| `enrollment_type` | `text` | `FREE`, `PAID`, `SUBSCRIPTION`, or `ADMIN_GRANTED`. |
| `enrolled_at` | `timestamptz` | Defaults to current time. |
| `expires_at` | `timestamptz` | Optional; if set, later than enrollment time. |
| `created_at`, `updated_at` | `timestamptz` | Creation and automatic update times. |

Indexes/constraints: partial unique `(student_id, course_id)` for `ACTIVE`
rows, unique `(id, student_id)` and `(id, student_id, course_id)` keys for
owner-matched payment/certificate FKs, and student/course status lookup
indexes. A student may create an active
enrollment only for a published free course. Paid, subscription, and
admin-granted enrollments require a trusted server-side operation. Students
cannot directly change or delete enrollment status. `complete_course_enrollment`
requires the configured published-lesson completion percentage and required
assessment outcomes.

### `public.lesson_progress`

| Column | Type | Meaning and rules |
|---|---|---|
| `id` | `uuid` | Primary key. |
| `student_id` | `uuid` | FK to `profiles.id`, delete restricted. |
| `lesson_id` | `uuid` | FK to `lessons.id`, delete restricted. |
| `status` | `text` | `NOT_STARTED`, `IN_PROGRESS`, or `COMPLETED`. |
| `progress_percent` | `integer` | 0–100. |
| `last_position_seconds` | `integer` | Nonnegative playback position. |
| `furthest_position_seconds` | `integer` | Greatest trusted playback position reached; may exceed the current resume position after a backward seek. |
| `last_accessed_at` | `timestamptz` | Most recent authorized lesson access or playback update. |
| `playback_updated_at` | `timestamptz` | Server timestamp used to bound forward playback progress. |
| `started_at`, `completed_at` | `timestamptz` | Consistent with progress status. |
| `updated_at` | `timestamptz` | Automatically maintained. |

Constraints enforce one row per `(student_id, lesson_id)` and consistent
status, timestamps, percentage, and position. A trigger also bounds the
current resume position by the referenced lesson duration when known.
Students can read only their own rows for accessible lessons; direct
authenticated `INSERT` and `UPDATE` privileges are revoked. Course managers
can read progress for their courses.

### Phase 8 lesson progress operations

The Phase 8 migration adds three student-scoped write operations:

- `record_lesson_access(target_lesson_id)` records a learner's authenticated
  access to a published lesson.
- `record_lesson_playback_position(target_lesson_id,
  target_position_seconds)` validates the lesson, enrollment, student role,
  nonnegative position, and configured duration. The database advances
  `furthest_position_seconds` by at most twice elapsed server time plus a
  short 10-second initial/reporting allowance, preventing a single client
  report from claiming an entire lesson. Backward seeks update the resume
  position without reducing the furthest position.
- `complete_lesson(target_lesson_id, completion_source)` accepts explicit
  `MANUAL` completion. `MEDIA` completion additionally requires a known media
  duration and a trusted furthest position of at least 90% of that duration.

`get_student_course_resume()` returns one published lesson per accessible
enrollment: the most recently active unfinished lesson, otherwise the next
unstarted lesson by curriculum order, otherwise the most recently accessed
completed lesson. It returns only the current student's resume projection.
`lesson_progress` now indexes `last_accessed_at` for these learner queries.
Functions use the verified student role and database enrollment checks; client
arguments never include a student identifier.

## Quizzes and assessments

### `public.quizzes`

`id` is the UUID primary key. `course_id` references `courses.id`;
`lesson_id` is an optional FK to `lessons.id` and a trigger verifies that it
belongs to the same course. `title` is required (1–180 characters); `description` and
`instructions` are optional; `time_limit_seconds` and `maximum_attempts` are
optional positive integers; `passing_score` is an optional percentage from
0–100; and `is_published` defaults false. Phase 9 adds `assessment_type`
(`PRACTICE` or `EXAM`), an optional availability window, question/option
randomization, partial credit, a per-incorrect-question penalty,
concurrent-attempt policy, and result-review/correct-answer/explanation
visibility settings. Later assessment work adds `assessment_scope`
(`COURSE`, `LESSON_CHECKPOINT`, `MODULE`, or `FINAL`), optional module placement,
and completion/certificate requirement flags. Publishing requires a valid
question set and answer configuration. Settings that affect scoring and
existing question/option content cannot be changed after an attempt has
started. Students see published quizzes in accessible courses, including
scheduled assessments before their start date so the schedule can be displayed.

### `public.quiz_questions`

`id` is the UUID primary key and `quiz_id` references `quizzes.id`.
`question_text` is required (1–10,000 characters); `question_type` is one of
`SINGLE_CHOICE`, `MULTIPLE_SELECT`, `TRUE_FALSE`,
`FILL_IN_THE_BLANK`, `SHORT_ANSWER`, `LONG_ANSWER`, or `MATCHING`; `points` is positive
`numeric(7,2)`; `position` is nonnegative and unique per quiz;
`grading_mode` is `AUTO` or `MANUAL`; short- and long-answer responses require
manual grading. Automatic fill-in questions use `accepted_answers` (with the
legacy `answer_key` retained for compatibility), plus case-sensitivity and
whitespace-normalization settings. Matching questions have 2–20 unique
prompts and answers; the aligned answer array is stored in the restricted
`answer_key` field and graded server-side. Students receive only
prompt/type/points/position fields. Accepted answers, answer keys,
explanations, grading mode, and correctness fields are excluded from student
column privileges. Optional `difficulty` is `EASY`, `MEDIUM`, or `HARD`;
`resource_links` holds up to five labeled HTTPS links, validated in PostgreSQL.
An assessment can contain at most 100 questions.

### `public.question_options`

`id` is the UUID primary key; `question_id` references
`quiz_questions.id`; `option_text` is required (1–4,000 characters);
`position` is nonnegative and unique per question; and `is_correct` is a
private boolean. Students can read option text and ordering, never the
correctness column. Course managers configure options and use the protected
answer-key operation to read correctness.

### `public.question_bank_items` and `public.question_bank_options`

The course-scoped reusable question bank stores question content, grading
configuration, difficulty/resources, and option snapshots separately from
assessment questions. A course bank is limited to 500 items. RLS allows only
the course manager/admin to read bank records; answer keys and option
correctness are never student-readable. Trusted instructor operations save a
question snapshot from an assessment and import a copy into an unpublished
assessment. A bank item can be imported only once into a given assessment.

`save_instructor_quiz_question_for_editor` stores long-answer questions as a
distinct question type while reusing the existing manual-response grading
path. `reorder_instructor_quiz_questions` checks instructor course ownership,
requires the complete question ID set, locks the assessment, and refuses
changes after publication or learner attempts; positions are updated in one
transaction without disabling the unique-position constraint.

### `public.quiz_attempts`

`id` is the UUID primary key; `quiz_id` and `student_id` reference their
respective parent records; `attempt_number` is positive and unique per
`(quiz_id, student_id)`; `score` is nullable until submission;
`total_points` is nonnegative; `status` is `IN_PROGRESS`, `PENDING_REVIEW`, or `GRADED`; and timestamps
track start, submission, creation, and the server-computed deadline.
`is_expired` records automatic or late finalization. A consistency constraint
prevents active attempts from having results and permits negative scores when
negative marking is configured. Indexes support student history and quiz
status reporting. Administrator review notes are not stored on this
student-readable row.

`start_quiz_attempt` serializes starts for a student/assessment, verifies
availability, enrollment, concurrent-attempt policy, and attempt limits, and
persists the selected question and option order in
`public.quiz_attempt_questions`. `save_quiz_answer` validates attempt
ownership, deadline, question membership, response type, and option IDs;
students cannot insert or update `quiz_answers` directly. Starting an attempt
creates one answer record per question, including unanswered questions.

### `public.quiz_attempt_questions`

Stores one row per question in an attempt. `position` and `option_order` are
generated at attempt start and remain stable on reload; `is_flagged` is
updated through the validated answer-save operation. Students can read only
their own attempt ordering and course managers can read their course's
attempt ordering.

### `public.quiz_answers`

`id` is the UUID primary key; `attempt_id` and `question_id` reference their
parent records; `selected_option_ids` is a UUID array; `answer_text` is
optional; `awarded_points` is private trusted grading output; and
`created_at` is the record creation time. One answer per question per attempt
is allowed. Student response data is written only through
`save_quiz_answer`; the client cannot write `awarded_points`.

`submit_quiz_attempt` validates and grades on the server, applies configured
partial credit and negative marking, and closes expired attempts using their
saved responses instead of leaving them active. Manual answers move the
attempt to `PENDING_REVIEW`; `grade_quiz_answer` allows only the course
instructor or an admin to award a bounded manual score.
`get_student_quiz_attempt` returns only the owner's response data, and reveals
correct choices/explanations only after submission when explicitly enabled.

### `public.assessment_attempt_reviews` and
`public.assessment_attempt_review_events`

The current review state is one row per attempt with `FLAGGED` or `CLEARED`
status, a required reason, administrator, and timestamp. The event table is
append-only and preserves each decision. Both tables are readable only by
administrators; client writes are revoked and changes use
`admin_review_assessment_attempt`. No automatic suspicion scoring is
performed.

## Subscription and payment records

### `public.subscription_plans`

UUID primary key; required name (1–120 characters) and unique slug;
optional description; nonnegative integer `price_cents`; uppercase
three-letter `currency`; `billing_interval` of `DAY`, `WEEK`, `MONTH`, `YEAR`,
or `ONE_TIME`; positive `interval_count` (one for `ONE_TIME`); `is_active`;
and timestamps. Phase 12 adds nullable `billing_cycles` (required and positive
for Razorpay checkout), `razorpay_plan_id`, and `razorpay_plan_mode`
(`test`/`live`). A Razorpay plan reference is unique. Public users see active
plans; admins can create, edit display metadata, activate, and deactivate
plans. The Phase 12 migration changes the default for newly created plans to
inactive, requiring explicit administrative activation. Billing terms are not
editable through the metadata form; create a new plan for different terms.
Pricing or renewal terms are never invented by checkout.

### `public.subscriptions`

UUID primary key; `student_id` and `plan_id` FKs use delete restriction;
`status` is `PENDING`, `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELLED`, or
`EXPIRED`; `provider` is `RAZORPAY`, `STRIPE`, or `MANUAL`;
`provider_subscription_id` is optional; period bounds must be ordered; and
`cancelled_at`, `created_at`, and `updated_at` are timestamps. Phase 12 adds
`HALTED` and `PAUSED` states, `cancel_at_period_end`,
`provider_state_updated_at`, and provider term snapshots for amount, currency,
plan name, and finite billing cycles. Provider IDs are unique when present.
Composite foreign keys require the referenced enrollment or subscription to
belong to the same `student_id` as the payment. Students and admins may read;
client writes are not granted.

### `public.payments`

UUID primary key; `student_id` references `profiles.id`; exactly one of
`course_id` or `subscription_id` is set; `enrollment_id` is nullable until a
course purchase is verified. `amount_cents` is a positive integer; `currency`
is an uppercase three-letter code; provider and status use constrained values.
Provider payment/order IDs, transaction references, idempotency keys, and
receipt numbers are unique in their scope when present. `purchase_description`,
payment method, bounded failure details, and refunded amount are stored
without card data or provider secrets. `paid_at`, `created_at`, and
`updated_at` are timestamps. History-preserving FKs do not cascade. Students
and admins may read; clients cannot insert, update, or delete financial
records. Provider status and course enrollment must be written only by trusted
server/webhook processing. Printable receipts are not tax invoices; refund
execution is not implemented.

### `public.payment_events`

UUID primary key; constrained provider; required provider event ID and type;
`processing_status` is `RECEIVED`, `PROCESSING`, `PROCESSED`, or `FAILED`;
`processing_error` contains only a bounded safe error code; and
`processed_at`/`created_at` track processing. `(provider,
provider_event_id)` is unique to prevent duplicate webhook processing.
Only admins can read; client writes are not granted. The table stores no raw
webhook body or secret.

## Certificates and notifications

### `public.certificates`

UUID primary key; `student_id`, `course_id`, and `enrollment_id` reference
their owners; a composite FK ensures the enrollment is for the same student
and course; `enrollment_id`, `certificate_number`, and `verification_code`
are unique; `issued_at` defaults to now; `certificate_url` is an optional
HTTP(S) URL; `certificate_storage_path` is a unique private-bucket path
scoped to the student and certificate; and `status` is `ISSUED` or
`REVOKED`. Student/course indexes support authorized lookups.

Clients cannot insert, update, or delete certificate rows directly. Internal
database triggers auto-complete eligible enrollments and issue one certificate
per enrollment when configured requirements are satisfied. A one-time
migration backfill applies the same checks to enrollments that were already
eligible. Migration `20261111020000_automatic_certificate_issuance.sql`
reevaluates eligibility after lesson completion, assessment grading, policy
changes, and lesson or assessment publication changes. Certificate identifiers
are random and protected by unique constraints; issuance and revocation are
recorded in `certificate_events`.
`course_certificate_requirements` stores the manager-configured lesson
completion percentage, required-assessment policy, final-exam requirement, and
minimum final score for each course. `get_course_certificate_eligibility`
returns a role-checked learner/course-manager projection. Automatic course
completion and certificate issuance use the same server-side eligibility
rules; issuance requires a completed enrollment and is idempotent per
enrollment. Students cannot execute a certificate-issuance RPC.
`revoke_course_certificate` is limited to the course manager or an admin and
requires a reason. `verify_certificate` returns
the learner's display name, certificate number, course title, issue time, and
current issued/revoked status for a valid verification code. It does not expose
email, user ID, revocation reason, or private object path. The student PDF
download route verifies ownership and generates the file on demand.

The admin read projection joins `profiles` through the explicit
`certificates_student_id_fkey` and `courses` through
`certificates_course_id_fkey`. This is required because `certificates` also
references `profiles` through `revoked_by`; an unqualified PostgREST profile
embed is ambiguous. Certificate lifecycle events are fetched only for the
returned certificate IDs, and no event query is issued for an empty result.

### `public.course_certificate_requirements`

One row per course, manager-owned through RLS. The row configures the required
published-lesson completion percentage, whether designated/passing
assessments are mandatory, whether a final exam is mandatory, and its minimum
score. Defaults preserve the 100% lesson completion policy, require designated
assessments, do not require a separate final exam, and set its score threshold
to 70%.

### `public.certificate_events` (Phase 14)

Append-only issuance/revocation history with a certificate FK, nullable actor,
event type, optional private revocation reason, and timestamp. Only admins can
read this table; application users cannot insert, update, or delete events.

### `public.notifications`

UUID primary key; `user_id` references `profiles.id`; required title
(1–180 characters), message (1–5,000 characters), constrained notification
type; optional same-site relative `target_url`; `is_read` and `read_at` must
be consistent; and `created_at` is the creation time. A partial index
supports unread notifications. Users read and update only their own
read-state columns. `mark_notification_read` is the safe per-user operation;
notification content remains private to its owner, including from admins.

### `public.notification_preferences` (Phase 14)

One row per profile with boolean preferences for course, assessment,
certificate, live-class, and billing updates. Users may read and update only
their own preference row. Workflow notification triggers honor these settings;
email, push, and scheduled reminders are not configured.

### `public.student_learning_goals` (Phase 7)

The profile UUID is both the primary key and FK to `profiles.id`. Daily lesson
targets are constrained to 1–20; weekly lesson targets to 1–100; timezone is
a validated IANA timezone; and preferred language is optional (2–80 trimmed
characters). `created_at` and `updated_at` are maintained by the shared
timestamp trigger. RLS permits a student to read and update only their own
row; instructors and anonymous users have no access.

## Live classes and platform configuration

### `public.live_classes`

UUID primary key; `course_id` and `instructor_id` reference their owners;
required title; optional description; constrained `meeting_provider`;
nullable private `meeting_reference`; start/end timestamps with end after
start; constrained status `DRAFT`, `SCHEDULED`, `CANCELLED`, or `COMPLETED`;
optional capacity from 1 to 1,000; meeting status; optional provider meeting
ID; and timestamps. Course/time and instructor/time indexes support schedules.
The host-provided link is not provider-verified unless a future integration
updates its status.

Authenticated users do not receive table-wide `SELECT` or `SELECT` on
`meeting_reference`/provider IDs. Limited safe columns are granted directly;
`get_live_class_meeting_reference` returns a link only to an authorized class
manager or a registered learner with active course access. Public roles have
no live-class access.

### `public.live_class_registrations`

UUID primary key; `live_class_id` and `student_id` FKs; status is
`REGISTERED`, `CANCELLED`, `ATTENDED`, or `NO_SHOW`; `registered_at` defaults
to now; and each student can register once per class. Attendance records
include the marking actor/time and `INSTRUCTOR` or `PROVIDER` source. Students
register only through a transactional operation that checks future schedule,
course access, capacity, and time conflicts. Instructors record attendance
after class through a role-checked RPC; an admin-readable event table retains
the audit history.

### `public.platform_settings`

`setting_key` is the primary key with constrained lowercase key format and
blocked credential/secret-like names; `setting_value` is JSONB;
`description` is optional; `is_public` defaults false; `updated_by` is an
optional profile FK; and creation/update timestamps are maintained. Public
roles see only rows explicitly marked public; admins manage settings. Do not
put credentials or secrets in this table—use the deployment secret manager.

## Phase 11 administrator workspace

The additive `20261109090000_add_admin_workspace.sql` migration adds
`public.admin_audit_logs` with UUID primary key, nullable administrator
profile reference, action and entity type, optional entity UUID/reason,
safe JSON metadata, and timestamp. Indexes support newest-first, action, and
entity history queries. RLS permits admin reads only; application roles have
no insert, update, or delete privileges. Security-definer triggers record
profile role changes, course status changes, category creation/updates,
assessment publication changes, and setting creation/updates. Secret values
and learner responses are excluded from metadata.

The migration replaces `admin_set_user_role` with a serialized role operation
that blocks self-role changes and prevents races that could remove the final
administrator. `admin_moderate_course` supports publication, correction return,
archive, and restore with a required reason. Archiving preserves enrollment and
progress rows and retains prior published state for restoration. `admin_unpublish_assessment`
changes only assessment publication state and does not modify existing
attempts. Role and moderation operations use the existing server-verified
`create_admin_notification` function to send in-app notices.

Read-only admin functions provide bounded/searchable profile, course, and
assessment pages; exact platform overview/report aggregates; and assessment
participation aggregates. Assessment list/detail projections intentionally
exclude answer keys, correct-option flags, and learner responses. Reports
include role/course status distributions, calendar-month enrollments, most
enrolled courses, instructor course/enrollment activity, aggregate lesson
progress records, and graded assessment score averages.

The existing schema does not define instructor applications, account
suspension, account status, or a supported Auth-user deletion operation.
Those are not represented as working features in this phase. Category
deactivation is supported; authenticated category/settings deletion is revoked
so referenced and operational records are not removed through the application.
The admin settings UI rejects secret- and payment-like keys; generic settings
do not affect application behavior unless explicitly consumed by code.

The transactional test fixture is
`supabase/tests/admin_workspace.test.sql`. It covers administrator guards,
registration role defaults, filtered admin queries, role and course moderation,
assessment publication control, and audit-log privileges. Run it with
`supabase test db supabase/tests/admin_workspace.test.sql` against an isolated
Supabase test stack.

## Index, trigger, and policy inventory

Domain-specific unique and lookup indexes are listed above. In addition:

- `updated_at` triggers call Phase 4's `public.set_updated_at()` for
  categories, courses, sections, lessons, enrollments, progress, quizzes,
  plans, subscriptions, payments, live classes, settings, student learning
  goals, and AI tutor conversations.
- AI tutor message inserts touch their owned conversation's `updated_at`
  timestamp through a narrowly scoped trigger.
- Every new public domain table has RLS enabled. Existing `profiles` RLS is
  preserved.
- Authorization helper functions and Storage policies are documented in
  [DATABASE_SECURITY.md](./DATABASE_SECURITY.md).
- The Phase 5 schema migrations add no seed records, checkout routines, or
  video-provider integrations.

## Marketplace public-read contracts (Phase 6)

The Phase 6 migration adds GIN full-text indexes for published course search
and active category names. It adds narrow `SECURITY DEFINER` read functions;
each fixes `search_path`, explicitly revokes default public execution, and is
granted only to `anon` and `authenticated` for its public catalog purpose:

- `search_published_courses(...)` validates pagination and filter values and
  returns a count plus one bounded page of published course cards. Search
  covers course title, descriptions, language, and active category names.
  Language, difficulty, price, category, sort, and optional instructor filters
  are combined in the database. The result includes only public instructor
  display name/avatar fields, never email, and reports available languages.
- `get_public_course_details(target_slug)` returns a published course's public
  details and active category labels, or `NULL` for an unpublished/missing
  course. It does not expose instructor data.
- `get_public_course_categories()` returns active categories that have at
  least one published course, with actual published-course counts.
- `get_public_instructor_profile(target_instructor_id)` returns only an
  instructor's ID, display name, and avatar when they have a published course.
- `get_public_course_curriculum(target_course_id)` returns ordered sections
  and published lesson metadata (including preview flags) for a published
  course. It intentionally excludes lesson descriptions, content JSON, media
  paths/URLs, and unpublished lesson rows.

These read functions do not alter table RLS. Course enrollment remains a
direct authenticated insert guarded by the existing `Students enroll in
published free courses` policy and partial unique active-enrollment index.
The application rechecks the verified profile role and reads the stored course
price before insertion; database RLS remains authoritative. The free-course
policy cannot create a paid enrollment. Paid purchase uses the trusted
Phase 12 operation documented in [DATABASE_SECURITY.md](./DATABASE_SECURITY.md).

## Student learning hub contracts (Phase 7)

The Phase 7 migration adds the student-owned `student_learning_goals` table
and these database functions:

- `get_student_course_progress()` returns per-enrolled-course counts over
  published lessons and the most recently updated progress item. It is
  `SECURITY INVOKER`, checks the authenticated student role, and relies on
  existing RLS.
- `get_student_learning_streak(target_timezone)` counts actual completed
  lesson and submitted-quiz calendar dates in the validated IANA timezone.
- `get_student_learning_activity(target_offset, target_limit, requested_type)`
  returns a bounded, filtered page of the caller's enrollment, lesson,
  submitted-quiz, and issued-certificate events with a total count.
- `get_public_instructor_profiles(target_instructor_ids)` returns only
  display name and avatar for instructors with published courses; it does
  not expose email or private profile fields.

The first three functions are `SECURITY INVOKER`, use an empty fixed
`search_path`, and are executable only by `authenticated`. The public
instructor projection is a narrowly scoped `SECURITY DEFINER` function with
an empty fixed `search_path`, bounded input, and explicit role grants.
Timezone validation rejects values absent from PostgreSQL's IANA timezone
catalog. Application-side daily and weekly goal ranges use the learner's
timezone and UTC instants, including daylight-saving transitions.

## AI tutor (Phase 13)

The additive `20261109120000_add_ai_language_tutor.sql` migration adds:

- `public.ai_tutor_conversations`: student-owned conversation title, practice
  mode, learning language, CEFR level, optional topic, and timestamps.
- `public.ai_tutor_messages`: student-owned user/assistant text linked to an
  owned conversation. Each message is bounded to 12,000 characters; recent
  model context is separately limited by the application.
- `public.student_saved_vocabulary`: student-owned word, meaning, language,
  optional example, and optional source conversation. The source is set null
  when its conversation is deleted; deleting a vocabulary item is explicit.
- `public.ai_tutor_daily_usage`: a single per-student UTC-date counter row
  with no direct authenticated read or write grant.

The six stored modes are `conversation`, `grammar`, `vocabulary`, `writing`,
`interview`, and `daily-practice`. Supported languages and CEFR levels are
constrained in the database. RLS limits all tutor content to student owners.
`consume_student_ai_tutor_quota()` atomically permits at most 20 requests per
student per UTC date; it returns only whether the request was allowed.

## Migration and rollback considerations

Apply migrations in filename order after the Phase 4 profile migration. The
migrations are additive; review them against the target database before
deployment. The storage-bucket insert leaves existing same-named bucket
settings unchanged, so operators must verify their visibility, file-size,
and MIME-type configuration before deploying.

There is no destructive `down` migration. To roll back a deployment, first
disable the affected application routes and policies with a reviewed forward
migration. Do not drop tables, buckets, or records as an automated rollback;
preserve learning and financial history.

## Latest local Supabase verification

The local Supabase stack has applied migrations through
`20261110120000_remove_unused_admin_assessment_state.sql`. The full
`supabase test db` run passed all 14 database test files and 348 assertions.
This includes course publication readiness, instructor reordering, private
quiz answer columns, marketplace access, payment lifecycle, Storage policies,
and student learning data. The local test fixtures run in rolled-back
transactions; this does not verify a hosted project or an authenticated
browser journey.
