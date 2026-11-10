# LingoPro Database Security

## Trust boundaries

Authorization is enforced by PostgreSQL RLS and narrowly scoped RPCs, not by
navigation state, client-supplied roles, or hidden UI. `profiles.role` is the
trusted role source from Phase 4. Auth metadata is not consulted for access
decisions. Admin promotion remains a separately documented trusted operator
action.

All `SECURITY DEFINER` functions use `SET search_path = ''` and schema-qualified
objects. Public/anonymous execution is revoked unless a function intentionally
serves a limited public operation. The Phase 4 `current_user_is_admin()` helper
is reused; it does not read user-editable metadata. New role and ownership
checks query the verified profile and course records.

RLS is enabled on every new public application table. No policies grant
unrestricted access to `authenticated`. Service-role access is intended only
for trusted server-side provider operations; the service-role key must never
be supplied to the browser or a `NEXT_PUBLIC_*` environment variable.

## Access matrix

| Domain | Anonymous visitor | Student | Instructor | Admin |
|---|---|---|---|---|
| Profiles | No access | Own profile and permitted profile fields | Own profile and permitted profile fields | Read profiles and use the Phase 4 role operation |
| Categories | Read active rows | Read active rows | Read active rows | Read/manage all rows |
| Courses | Read published course details | Read published courses; enrolled learners can access their published or archived course | Manage own courses; create drafts and edit drafts/pending review | Read/manage all; review and publish |
| Sections and lessons | No direct access | Published lesson content when enrolled; only explicitly published preview lessons otherwise | Manage content for owned courses | Manage all content |
| Lesson media | No access | Private media with current course access; published preview media only where the lesson explicitly allows preview | Manage objects linked to owned lessons | Manage all course objects |
| Lesson resources | No access | Private resources only for published lessons with current course access; preview lessons do not expose downloadable resources | Manage objects linked to owned lessons | Manage all course objects |
| Enrollments | No access | Read own; direct enrollment only into published free courses | Read enrollment records and limited roster for own courses | Read platform-wide records; trusted backend operations manage status |
| Progress | No access | Read own progress; write only through student-scoped progress RPCs | Read progress for owned courses | Read platform-wide progress |
| Quiz and questions | No access | Read published assessments and learner-safe prompt/options fields in accessible courses | Manage own assessments and read their answer keys | Manage all assessments |
| Attempts and answers | No access | Read own attempts/results; save responses and flags only through owner-scoped RPCs | Read attempts/answers for owned courses; grade manual answers | Read platform-wide records and grade |
| Plans | Read active plans | Read active plans | Read active plans | Manage plans |
| Subscriptions/payments | No access | Read own records; cannot write status or amounts | No payment access | Read appropriate platform records; writes are trusted backend-only |
| Payment events | No direct access | No direct access | No direct access | No direct client access; trusted server processing only |
| Certificates | No access | Read own certificates | Read/revoke certificates for owned courses | Read/revoke platform-wide; issuance is automatic |
| Notifications | No access | Read own and change own read state/preferences | Read own and change own read state/preferences | Read own only; cannot inspect another user's content |
| Learning goals and reports | No access | Read/update own preferences and read own learning reports | No access to student preferences or reports | No direct student preference access |
| Live classes | No access | Read eligible registered-class details; retrieve meeting reference only after registration and current enrollment checks | Manage classes for owned courses | Manage platform-wide |
| Platform settings | Read only `is_public` rows | Same public rows | Same public rows | Read/manage all rows |
| AI tutor | No access | Own conversations, messages, and saved vocabulary; 20 model requests per UTC day | No access | No direct tutor-content access |

Course managers are the instructor who owns a course or an administrator.
Instructor enrollment visibility is limited to enrollment identifiers/status
and a roster RPC returning student ID, display name, status, and dates—not
email addresses or payment information.

### Instructor course drafts

The `courses` INSERT policy requires an authenticated `auth.uid()` matching
`instructor_id`, an authoritative `profiles.role = 'instructor'`, `status =
'DRAFT'`, and a null `published_at`. The instructor server action now reuses
the same cookie-aware Supabase client for role verification and the database
mutation, preventing role checks and writes from observing separate session
refresh contexts. Draft inserts do not request `RETURNING`: that would also
apply the courses SELECT policy in the insert statement, before the new row is
visible to the stable `can_manage_course` check. The action then performs a
separate owner-scoped read and requires Supabase to return the inserted ID.
Edits likewise require a returned owned row. No service-role or RLS-bypass path
is used.

The linked production policy and role helper were inspected read-only and
match the local migrations. The previously failing authenticated form
submission returned `42501`; with the same account, values, and policy, the
separated insert/read path saved the course and returned its persisted ID. The
live row belongs to the authenticated instructor and remains unpublished.

### Lesson ownership without recursive RLS

The former `Course managers manage lessons` `WITH CHECK` queried
`course_sections` as the caller. The section SELECT policy can query `lessons`
for published previews, which re-entered the lesson policies and raised
`42P17: infinite recursion detected in policy for relation "lessons"`.
Migration `20261110170000_fix_lesson_rls_recursion.sql` adds the narrowly
granted `SECURITY DEFINER` helper `can_manage_section(section_id)` and uses it
for the lesson write check. The helper resolves the section and course under
its fixed empty search path and delegates ownership to `can_manage_course`;
RLS remains enabled and cross-owner writes remain denied.

The instructor test now also covers owned lesson insertion/retrieval and
cross-owner denial. The authenticated production form successfully created a
published text lesson in the owned draft after the migration. The expanded
local pgTAP suite was not run because Docker was unavailable.

## Authorization functions and sensitive operations

### RLS helpers

`current_user_has_role`, `can_manage_course`, `can_access_course`,
`can_manage_section`, `can_manage_lesson`, `can_access_lesson`, `can_access_quiz`,
`can_manage_live_class`, `can_access_live_class`, and
`can_enroll_free_course` are `SECURITY DEFINER` helpers with a fixed empty
search path. They make ownership/enrollment decisions from the database and
avoid recursive policy lookups. The `storage_can_*` helpers validate UUID
path segments before casting and bind object access to a course, lesson, or
certificate row.

`can_access_course` requires an active or completed enrollment whose expiry
has not passed for a student. Course managers and admins have access through
their authoritative profile and ownership. Preview media access is limited to
published lessons explicitly marked preview; downloadable lesson resources
require enrollment.

### Assessment and progress operations

- `start_quiz_attempt` serializes starts for each student/assessment,
  validates publication, availability, course access, attempt limits and the
  concurrent-attempt policy, then stores a stable question/option order.
  Students cannot insert attempts or set deadlines/scores.
- Direct authenticated `INSERT` and `UPDATE` on `quiz_answers` are revoked.
  `save_quiz_answer` verifies attempt ownership, enrollment, server deadline,
  question membership, response type, option membership, and input bounds;
  it also updates the attempt-owned review flag. It never accepts a
  student/owner ID from the caller.
- `submit_quiz_attempt` grades on the server, applies configured partial
  credit and per-incorrect-question penalties, and finalizes work on timeout.
  Expired attempts are closed and marked `is_expired`; they cannot remain
  active or receive later answer writes. Repeated submission is idempotent.
  Manual responses are `PENDING_REVIEW` and are finalized by the existing
  course-manager-only `grade_quiz_answer`.
- `get_student_quiz_attempt` returns only the authenticated student's attempt
  and responses. Correct-option flags and explanations are projected only
  after submission and only when the assessment's result-review settings
  permit disclosure. Matching choices are generated from restricted answer
  keys inside this RPC; in-progress responses never include the pair mapping.
  Table-wide `SELECT` is revoked from anonymous and authenticated roles.
  Students receive only the prompt, type, points, position, safe metadata,
  and option text/order columns; accepted answers, answer keys, grading mode,
  explanations, option correctness, and grading outputs remain restricted.
- Publication validates question/option completeness. Question and option
  content, and score-affecting assessment settings, become immutable once an
  attempt exists so concurrent or historic grading cannot change underneath
  a learner.
- Course-scoped question-bank tables are readable only by the owning course
  manager or an admin; students have no bank-table grants. Save/import RPCs
  recheck course ownership, preserve answer keys in restricted columns, and
  import only into an unpublished assessment with no attempts. Database
  triggers enforce the 500-item-per-course bank and 100-question-per-
  assessment limits. Question resource metadata is validated as labeled
  HTTPS URLs in PostgreSQL.
- Attempt-review state and append-only history are kept outside the
  student-readable attempt tables. Only administrators can read them;
  `admin_review_assessment_attempt` rechecks admin authority and requires a
  3–1,000 character reason for each manual flag/clear decision. No automatic
  suspicion heuristic or score-triggered flag is applied.
- `get_quiz_answer_key` is restricted to the owning course instructor/admin.
  `grade_quiz_answer` bounds manual scores to the question's points and
  finalizes an attempt after manual answers are graded.
- Automatic course completion and certificate issuance use the same
  server-computed eligibility policy: configured published-lesson percentage,
  designated/passing assessments, and optional final-exam minimum. Course
  managers alone can change these per-course requirements. Module and final
  assessment prerequisites are checked before attempts are created.
- Unexposed security-definer functions recheck eligibility while locking the
  enrollment. A unique enrollment constraint prevents duplicate certificates;
  students cannot execute issuance or directly update enrollment or certificate
  status.

### Lesson playback and completion (Phase 8)

The Phase 8 migration revokes direct authenticated `INSERT` and `UPDATE` on
`lesson_progress`. `record_lesson_access`, `record_lesson_playback_position`,
and `complete_lesson` validate the authenticated student role and current
lesson access in PostgreSQL; clients cannot choose the `student_id`.

Playback position writes are bounded by the lesson duration and by elapsed
server time: forward progress can advance at no more than twice elapsed time,
plus a 10-second initial/reporting allowance. The database stores both the
current resume position and a monotonic furthest position, so seeking backward
does not erase prior progress or violate constraints. `MEDIA` completion
requires a known media duration and a stored furthest position of at least 90%
of that duration. Explicit `MANUAL` completion remains available for lessons
completed by the learner without a media completion event.

`get_student_course_resume` is an invoker-rights projection restricted to the
current student and accessible enrollments. It returns one published lesson
per course, preferring an unfinished lesson, then a next unstarted lesson,
and finally the most recently accessed completed lesson.

### Student assessment workflows (Phase 9)

The Phase 9 migration adds no student write grants. The browser calls
authenticated server actions, which invoke the scoped database operations
above. Assessment details and history use the existing course/enrollment RLS;
attempt question order and response/result data are scoped to the owning
student. The timeout uses a database-generated deadline, and the database
checks it on every save and submit regardless of client clock.

The assessment SQL test extends the existing learning-platform test with
trusted autosave, active-attempt uniqueness, option validation, private
answer-key projections, post-attempt immutability, timeout finalization, and
idempotent submission assertions.

### Instructor workspace operations (Phase 10)

Instructor pages and server actions independently require the verified
`instructor` role. Every course mutation checks that the authenticated
instructor owns the course; RLS and the database functions remain the final
authorization boundary. Course status transitions preserve the administrator
publication boundary: instructors can create drafts and submit them for
review, but cannot publish or archive a course.

`get_course_student_roster` is the only roster-name source used by the
workspace. It returns student ID, display name, enrollment status, and dates
for one managed course; instructor pages do not read student email, payment
details, or unrelated learner profiles. Progress and assessment queries are
restricted to lessons and quizzes in the instructor's courses.

`reorder_course_sections` and `reorder_section_lessons` require a manager for
the target course and validate that the submitted ID array is duplicate-free
and exactly matches the complete set of children being reordered.
`save_instructor_quiz_question` locks the assessment row, checks ownership,
requires it to be unpublished, and replaces question fields and option rows
atomically. The database rejects changes after any attempt has started;
published assessment questions must be unpublished before editing. The
expanded `get_quiz_answer_key` remains manager-only and is the sole source for
instructor answer keys, accepted answers, and option correctness.
`reorder_instructor_quiz_questions` applies the same course-manager, draft,
and no-attempt checks, and accepts only a duplicate-free ordering containing
every question exactly once. Long-answer authoring uses the existing manual
grading state; the response remains learner-owned and receives no automatic
score.

Instructor and student read paths select permitted question columns directly
instead of embedding `quiz_questions` in a `quizzes` relation. This preserves
the intentional lack of table-wide `SELECT` on question tables: explicit
column grants and RLS still govern every row, and correct answers remain
available only through the manager-only answer-key RPC.

Course publication is database-guarded. New courses must start as drafts;
admins can publish only after every section has at least one published lesson
and each published lesson has valid media or reading content for its type.
Anonymous users receive no direct grants on course sections, lessons, lesson
resources, or student learning goals; public catalog and curriculum reads use
the limited marketplace RPCs instead. Authenticated users cannot directly
insert certificates.

The Phase 10 workspace supports HTTPS external lesson media and resource links
only. It does not issue Storage upload operations or expose private object
paths. Existing stored-media paths are not overwritten by lesson edits.

### Certificates and notifications

Certificate issuance is performed only by unexposed security-definer database
functions after the completed enrollment and per-course eligibility policy
are rechecked under a row lock. Triggers run when the final lesson or graded
assessment requirement is met and when certificate policy or published
curriculum changes; migration backfill handles already eligible enrollments.
Students cannot invoke issuance or directly insert, update, or delete
certificates. `revoke_course_certificate` remains scoped to an administrator
or the owning course manager. Anonymous `verify_certificate` returns
certificate identity and validity details without email, user ID, revocation
reason, or private object path.
The admin certificate read query explicitly names the student and course
foreign keys to avoid PostgREST ambiguity with the `revoked_by` profile
relationship. Audit events are restricted to the returned certificate IDs;
an empty certificate list produces an empty state without an event query.
This query correction does not change table grants, RLS policies, or trusted
certificate issuance.

### Public marketplace reads

The Phase 6 `20261109030000_add_marketplace_public_reads.sql` migration adds
bounded database-side search and four additional read-only catalog/profile
RPCs: `search_published_courses`, `get_public_course_details`,
`get_public_course_categories`, `get_public_instructor_profile`, and
`get_public_course_curriculum`. They use a fixed empty `search_path`, revoke
default `PUBLIC` execution, and grant execution only to the public Supabase
roles that need catalog reads. Their return projections are intentionally
limited: instructor email, lesson content, media references, and unpublished
rows are omitted. Search and filters run in PostgreSQL over published data;
the browser never loads the full catalog. Course content tables remain under
their original RLS policies.

Free enrollment uses the signed-in user's ordinary Supabase client. The
server action verifies the user and `profiles.role`, fetches the published
course's server-side price, checks the user's enrollment, and attempts the
free enrollment insert. Existing RLS independently enforces student identity,
published free-course status, and active enrollment uniqueness. A paid course
never creates an enrollment through the free-enrollment policy. Paid course
enrollment uses the trusted Phase 12 operation documented below.

`mark_notification_read` can update only the caller's row. Notification
creation is admin-only through `create_admin_notification`; notification
content is not writable by users.

### Student learning data (Phase 7)

`student_learning_goals` has RLS that binds each row to `auth.uid()` and the
verified student role. Target bounds and IANA timezone validity are enforced
in the database as well as validated by the server action. Students cannot
read or change another student's preferences.

`get_student_course_progress`, `get_student_learning_streak`, and
`get_student_learning_activity` are `SECURITY INVOKER` functions with a fixed
empty `search_path`, explicit authenticated-only execution, student-role
checks, and caller-scoped data. They expose bounded summaries and actual
timestamps, not lesson content, quiz answer keys, or another learner's
records. The activity function constrains offset, page size, and filter values.
Streaks count only completed lesson and submitted quiz timestamps in the
requested valid timezone; opening a dashboard does not write progress.

`get_public_instructor_profiles` is a bounded `SECURITY DEFINER` projection
for instructor names and avatar URLs only, and returns profiles only for
instructors with published courses. It does not expose email or learner data.

### Live class meeting data

`meeting_reference` is not granted to authenticated table readers. The
`get_live_class_meeting_reference` RPC requires the course manager or a
registered student with current enrollment. Live class table reads return
only non-secret schedule and description fields.

## Storage architecture and policies

The migration creates buckets with `ON CONFLICT DO NOTHING`; it does not
silently change existing bucket visibility or limits. Before rollout, check
that existing bucket settings match the expected settings below. Protected
learning media is not made public.

| Bucket | Visibility | Limit and intended content | Object path / authorization |
|---|---|---|---|
| `course-thumbnails` | Public read | 5 MiB; JPEG, PNG, WebP | `course-id/...`; only the owning instructor/admin can create, update, or delete |
| `lesson-media` | Private | 50 MiB; common video/audio MIME types | `course-id/lesson-id/...`; lesson must reference the path; course access or explicit lesson preview for reads; manager writes |
| `learning-resources` | Private | 25 MiB; PDF, image, audio | `course-id/lesson-id/...`; path must match a resource row; enrolled course access for reads; manager writes |
| `user-avatars` | Private | 5 MiB; JPEG, PNG, WebP | `user-id/...`; user owns read/write; admin may read |
| `certificates` | Private | 10 MiB; PDF | `student-id/certificate-id`; row must exist; student or course manager reads; manager writes |

Signed URLs should be short-lived and created server-side only after the
caller passes the same access checks. Do not persist long-lived signed URLs.
The `lesson-media` bucket is capped at the existing local Storage maximum of
50 MiB; use a dedicated streaming/video host for larger or adaptive-streaming
content rather than treating object storage as a video CDN.

The migration does not relax Storage's existing global policies. It adds
bucket-scoped policies with explicit path checks. Operators should also
confirm the deployed Storage global file-size limit is compatible with the
bucket-specific limits.

## Private data, billing, and external links

- Monetary values use integer minor units. No card numbers, CVVs, provider
  secrets, webhook signatures, or raw webhook bodies are stored in these
  tables.
- Provider event IDs and transaction/order IDs are unique where present to
  support idempotent server-side processing. This phase does not implement a
  gateway or make payment status editable by client roles.
- `platform_settings` rejects credential-like key names and exposes rows only
  when `is_public` is true. Never put secrets in this table; use a deployment
  secret manager.
- Database URL checks allow only HTTP(S) and reject whitespace. Any server
  feature that fetches a user-supplied URL must add application-side host,
  redirect, DNS/IP, and private-network protections; these tables do not
  authorize server-side fetching.
- The service-role key is not part of `.env.example` or client code.

## Verification

Run the transactional database tests with:

```sh
supabase test db supabase/tests/learning_platform_rls.test.sql
supabase test db supabase/tests/marketplace_public_access.test.sql
supabase test db supabase/tests/student_learning_hub.test.sql
supabase test db supabase/tests/student_lms.test.sql
```

The test covers anonymous catalog access, student isolation, progress,
automatic and manual quiz scoring, answer-key protection, payment and
certificate access, notification ownership, live meeting credentials,
instructor ownership, administrator operations, Storage object RLS, bucket
visibility, and scoped path authorization. Test records are rolled back.
The marketplace test covers published-only search/details, category and
instructor projections, private curriculum-field exclusion, filters, anonymous
enrollment rejection, free enrollment, duplicate protection, and rejection of
paid or unpublished enrollment.
The student-learning-hub test covers goal ownership and bounds, timezone
validation, course-progress and activity isolation, activity filtering,
streak calculation, and function privileges.
The Phase 8 LMS test covers trusted progress writes, playback rate bounds,
backward seeking, media/manual completion, resume projection, unpublished
lesson/resource denial, and enrollment isolation.

Schema linting can be run with:

```sh
supabase db lint
```

Do not use `supabase db reset` against any database containing user data.
## Verification record

- Both Phase 5 migrations and the Phase 4 migration applied successfully to
  an isolated PostgreSQL 18.3 cluster with minimal local `auth` and `storage`
  compatibility schemas. No Supabase credentials or hosted project were used.
- All 74 assertions in `learning_platform_rls.test.sql` and all 12 Phase 4
  profile assertions passed against the isolated PostgreSQL cluster using a
  temporary local TAP-compatible test harness. The fixtures exercised
  PostgreSQL RLS and the migration's Storage object policies; this is not a
  run of the official Supabase/pgTAP stack.
- The Phase 6 marketplace migration applied successfully to the same isolated
  PostgreSQL 18.3 cluster, and all 31 assertions in
  `marketplace_public_access.test.sql` passed with a temporary local
  TAP-compatible harness. Supabase-specific and provider-backed workflows
  remain unverified.
- The Phase 7 student-learning-hub migration applied to the isolated
  PostgreSQL compatibility cluster, and all 16 assertions in
  `student_learning_hub.test.sql` passed, including goal ownership and bounds,
  progress/activity isolation, timezone validation, and streak behavior.
  This is not official Supabase or authenticated application workflow
  verification.
- The Phase 8 LMS migration applied to an isolated PostgreSQL 18.3 clone of
  the Phase 7 database. All 25 LMS assertions, all 74 learning-platform RLS
  regression assertions, and all 16 Phase 7 student-hub assertions passed.
  The clone's Storage object table needed RLS enabled to match the Supabase
  Storage schema; the assertions then verified private object visibility and
  lesson/resource authorization. This is not official Supabase verification.
- The Phase 9 migration applied to a disposable PostgreSQL 18.3 compatibility
  database. A focused smoke test exercised publication validation, randomized
  order persistence, single-active-attempt enforcement, validated autosave,
  accepted fill-in answers, multiple-select partial credit, manual-review
  status, and timeout finalization. This did not run the full Supabase/pgTAP
  suite or authenticate through the application.
- At the earlier compatibility-cluster check, the local Supabase stack was
  unavailable. That historical status is superseded by the current local
  verification record below.

## Phase 11 administrator workspace

Every `/admin/**` route is protected by `requireRole("admin")`, which resolves
the current Supabase user and reads the trusted `profiles.role` on the server.
Each server action repeats that check. Database functions independently check
`auth.uid()` against `current_user_is_admin()`; browser navigation and form
validation are not authorization boundaries.

The Phase 11 `admin_audit_logs` table has RLS enabled, a read policy limited to
administrators, and no application-role insert/update/delete grants. Definer
triggers create safe audit metadata for role changes, course status changes,
category creation/updates, assessment publication changes, and setting
creation/updates. Role and moderation operations are transactional with their
audit records. Required course/assessment moderation reasons are captured;
settings values and secrets, assessment answer keys, and learner responses are
not stored in audit metadata. Category/settings deletion is revoked from
authenticated application roles.

`admin_set_user_role` is the only supported application role mutation path.
It serializes role changes with a transaction advisory lock, rechecks admin
authority after acquiring the lock, prohibits self-role changes, and blocks
demotion of the last administrator. User registration continues to provision
the `student` role regardless of user metadata. Course moderation and
assessment unpublishing require admin authority and a bounded reason. The
assessment operation only changes publication state; grading and attempts are
untouched. Course archive/restore preserves the underlying course and learning
records; archived courses keep the existing enrolled-learner access contract.
Affected account holders/instructors receive in-app notifications through the
existing administrator notification RPC.

The admin profile/course/assessment list and report functions are
`SECURITY DEFINER`, set an empty search path, revoke public execution, grant
only authenticated execution, and check admin identity internally. The
assessment projections omit answer-key fields and responses; aggregate reports
contain no learner identifiers. Direct admin table access continues to rely
on the existing administrator RLS policies for profiles, course content,
enrollments, settings, and assessments.

The schema has no instructor application/status model or account suspension
API. The UI therefore reports instructor relationships and allows the
trusted role workflow only; it does not pretend to approve applications or
suspend/delete Auth accounts. The existing generic `platform_settings` table
is used without payment options. Its screen blocks credential-like and
payment-like keys and warns that unused settings do not alter runtime
behavior. Avoid putting any secret value in the settings table; deployments
must use their secret manager.

`supabase/tests/admin_workspace.test.sql` contains transactional role/RLS,
admin query, moderation, and audit privilege assertions. It must be run with
the Supabase database test runner; isolated JavaScript/build checks do not
substitute for RLS, RPC, and migration verification.

## Phase 12 payment and subscription operations

The `20261109100000_add_razorpay_payment_lifecycle.sql` migration keeps all
financial writes behind service-role-only `SECURITY DEFINER` functions with a
fixed empty search path. Student checkout creation uses the signed-in user's
JWT and validates the student role, published course price, active enrollment,
plan state, and subscription terms in PostgreSQL. The browser cannot supply
an amount, currency, student ID, plan cycle count, payment status, or
enrollment status. Existing successful purchase and enrollment history is
preserved.

`src/lib/payments/actions.js` uses the official Razorpay SDK on the server to
create/fetch orders and subscription plans. Course verification checks the
callback HMAC, fetches the provider payment, checks order/amount/currency and
requires captured status before `complete_razorpay_course_payment` atomically
records the payment and creates the enrollment. Subscription checkout uses a
server-loaded plan with an explicit positive finite `billing_cycles` count;
payment receipt records are created only after provider verification.
Subscription state changes are provider-confirmed and event-timestamp ordered.
Paid subscriptions do not grant course enrollment because there is no
subscription-to-course entitlement relationship in the schema.

`/api/razorpay/webhook` validates `X-Razorpay-Signature` with the separately
configured server-only webhook secret against the bounded raw request body.
It uses the documented `x-razorpay-event-id` for idempotency, stores no raw
payload, and dispatches to `process_razorpay_webhook`. Duplicate processed
events are no-ops; failed events can be retried; older state events cannot
overwrite newer provider state. Course `payment.captured` and subscription
charge/activation events are processed transactionally. No webhook or
callback by itself grants access without amount, currency, ownership, and
provider-reference checks.

The service-role Supabase client is in `src/lib/supabase/service.js`, marked
server-only, and requires `SUPABASE_SERVICE_ROLE_KEY`; never expose it through
`NEXT_PUBLIC_*`, send it to the browser, or use it for student reads. Only
verified owners or admins may request printable receipts. The receipt is
explicitly not a GST tax invoice. Refund initiation, tax calculation, and
subscription-based course entitlements are not implemented. See
[PAYMENT_INTEGRATION.md](./PAYMENT_INTEGRATION.md) for dashboard setup and
verification steps.

`supabase/tests/payment_lifecycle.test.sql` covers transactional purchase and
subscription behavior. It must run against the Supabase database test runner;
unit signature tests and a successful build do not substitute for migration,
RLS, webhook, and Test Mode transaction verification.
All 37 assertions also passed against an isolated PostgreSQL 18 compatibility
cluster using local auth/storage and TAP-compatible test shims. That run does
not verify Supabase-specific RLS, Auth, or Storage integration.

## Phase 13 AI tutor data

The AI tutor routes require the authenticated profile role to be `student`.
Conversation, message, and saved-vocabulary tables have RLS enabled, with
ownership bound to `auth.uid()` and the authoritative student role. Messages
must belong to a conversation owned by the same student; a vocabulary source
conversation must also be owned by that student. Database foreign keys and
row policies keep one student from reading, writing, or deleting another
student's records. No tutor table is accessed with the service-role key.

`consume_student_ai_tutor_quota()` is a `SECURITY DEFINER` function with an
empty fixed search path. It checks the current authenticated student role and
atomically increments one per-student UTC-day counter up to 20. Direct grants
on the counter table are revoked; authenticated students can invoke only this
bounded function. User-provided messages are capped at 1,500 characters,
recent model context at 12 messages, generated replies at 700 output tokens,
and provider calls at 25 seconds. The route validates same-origin mutations,
does not log message content, and returns private no-store responses.

The Gemini API key and model selection are server-only. Requests use the
official `@google/genai` Interactions API with `store: false`; Google still
processes request content under its applicable API terms. LingoPro stores
chat text in Supabase until the student deletes the conversation. Deleting a
conversation cascades its messages and clears the source link from saved
vocabulary; vocabulary is separately deletable. `supabase/tests/ai_tutor.test.sql`
covers table RLS, cross-student access, and quota behavior. Live Supabase and
Gemini integration still require a configured test project and API key.

## Phase 14 certificates, live classes, and notifications

Database triggers check the completed enrollment, published lesson percentage,
required assessment results, and configured final-exam minimum before issuing
one certificate per enrollment. The same policy gates automatic course
completion, and migration backfill applies it to already eligible enrollments.
Students cannot invoke issuance or write certificate records. Revocation is
restricted to course managers/admins and requires a 10–1,000 character reason.
Certificate lifecycle events are append-only and admin-readable; the public
verification RPC exposes certificate identity and validity status but never
email, user ID, or private revocation details. The PDF endpoint verifies the
authenticated student owns an issued certificate before generating a private,
no-store download.

Live-class table privileges are reset in
`20261109160000_restrict_live_class_table_grants.sql` to remove default
table-wide access. Authenticated users receive only the safe read columns and
the instructor write columns required by the existing RLS policies;
`meeting_reference` and provider meeting IDs are not directly selectable.
`get_live_class_meeting_reference` checks course-manager or registered-learner
access on every call. Student registration is an atomic RPC enforcing future
schedule, course enrollment, class capacity, and conflicts. The instructor
attendance RPC checks course ownership and class end time, and writes an
append-only event for admin audit. No provider API confirms meeting creation
or attendance.

`notification_preferences` is user-owned and affects in-app workflow events.
Notification RLS permits users to read only their own content and update only
their own read-state fields; admins do not receive cross-user message access.
The tested local Supabase environment initially had broad default table grants
on `live_classes`; the Phase 14 migration explicitly removes them and restores
only the required column grants. The Phase 14 focused test verifies that
direct meeting-link reads fail while the authorized RPC succeeds.

## Latest local Supabase verification

The local Supabase stack applied migrations through
`20261111020000_automatic_certificate_issuance.sql`. The focused certificate
database tests passed 68 assertions across three test files. The full
`supabase test db` run still fails in the separate assessment-authoring suite
with a `quiz_questions` permission error and a missing authoring function;
the certificate, Phase 14, student-learning-hub, and lesson RLS suites pass.
The prior 14-file, 348-assertion full-suite result is historical and does not
include the latest certificate migration. The build and lint checks are
recorded in [FEATURE_STATUS.md](./FEATURE_STATUS.md).

## Recovery audit: hosted checks

The configured hosted project contains three profiles (one per student,
instructor, and admin role), one active course category, one instructor-owned
free course in `PENDING_REVIEW`, one section, one published text lesson, and
the eligible learner enrollment and certificate described below. The approved
recovery course is intentionally not public while pending review. The live
instructor browser verified course creation, editing, curriculum creation, and
submission for review. Admin moderation and student-facing pages still require
their respective authenticated browser sessions. The course-list RPC was
inspected and includes all statuses by default; the admin UI itself was not
tested with an admin session.

## Automatic certificate issuance: production verification

Migration `20261111020000_automatic_certificate_issuance.sql` is recorded in
production migration history. Its eligibility backfill completed the reported
learner's eligible enrollment and issued one certificate for
`English Foundations: Beginner to Confident Speaker`. A read-only production
query confirmed `COMPLETED` enrollment status, `ISSUED` certificate status,
matching student and course relationships, and exactly one certificate for
the enrollment. The production verification RPC grants execution to
`anon` and `authenticated`; direct invocation through the restricted
read-only SQL tool was denied. The learner Achievements page, public
verification page, and admin registry are reported to show the issued
certificate. The PDF download failed with PostgREST `PGRST201` / HTTP 300
because its unqualified profile embed matched both the student and revoker
relationships. The route now names the student/course foreign keys explicitly;
the equivalent PostgREST select returns HTTP 200. Actual authenticated PDF
download, cross-student denial, and revoked-certificate denial remain to be
verified with the learner/admin browser sessions.
