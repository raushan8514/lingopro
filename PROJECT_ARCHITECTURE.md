# LingoPro Project Architecture

## Technology stack

- **Application:** Next.js App Router, React, JavaScript, and JSX.
- **Styling:** Tailwind CSS v4 with CSS-first theme configuration and global
  design tokens.
- **Motion and icons:** Framer Motion and Lucide React.
- **UI utilities:** `clsx`, `tailwind-merge`, and
  `class-variance-authority`.
- **Backend:** Supabase PostgreSQL, Auth, and Storage use `@supabase/ssr` and
  `@supabase/supabase-js`; domain migrations define database access and
  Storage policies.
- **AI tutor:** Google's official `@google/genai` Node SDK calls the Gemini
  Interactions API from server-only code. The key is `GEMINI_API_KEY`; client
  code never receives it and provider interaction storage is disabled.
- **Quality:** ESLint, npm, and production builds.

## Current directory structure

```text
src/
  app/
    (marketplace)/
      categories/
        [slug]/page.js
        page.js
      courses/
        [slug]/page.js
        actions.js
        loading.js
        page.js
      instructors/
        [id]/page.js
      layout.js
      marketplace.css
    admin/
      actions.js
      layout.js
      page.js
      payment-actions.js
      payments/page.js
      subscriptions/page.js
    auth/
      actions.js
      callback/route.js
    design-system/
      page.js
      showcase.js
    forgot-password/
      page.js
    instructor/
      layout.js
      page.js
      actions.js
      instructor.css
      courses/
        page.js
        new/page.js
        [courseId]/page.js
        [courseId]/curriculum/page.js
        [courseId]/students/page.js
        [courseId]/assessments/page.js
        [courseId]/assessments/new/page.js
      assessments/
        page.js
        [assessmentId]/page.js
      profile/page.js
      settings/page.js
    login/
      page.js
    register/
      page.js
    reset-password/
      page.js
    student/
      layout.js
      page.js
      actions.js
      loading.js
      error.js
      achievements/page.js
      activity/page.js
      courses/page.js
      courses/[courseId]/learn/page.js
      courses/[courseId]/learn/[lessonId]/page.js
      goals/page.js
      ai-tutor/page.js
      notifications/page.js
      profile/page.js
      progress/page.js
      settings/page.js
      student.css
    api/
      student/ai-tutor/
        messages/route.js
        conversations/[conversationId]/route.js
        vocabulary/route.js
      payments/[paymentId]/receipt/route.js
      razorpay/webhook/route.js
    favicon.ico
    design-system.css
    auth.css
    globals.css
    landing.css
    layout.js
    page.js
  components/
    courses/
      course-card.js
      course-catalog-controls.js
      course-thumbnail.js
      enrollment-action.js
      instructor-avatar.js
      marketplace-header.js
      marketplace-header-client.js
    auth/
      account-menu.js
      auth-forms.js
      auth-shell.js
      portal-placeholder.js
    landing/
      action-link.js
      course-preview.js
      faq.js
      feature-grid.js
      final-cta.js
      hero.js
      language-discovery.js
      learning-journey.js
      pricing.js
      product-previews.js
      section-heading.js
      site-footer.js
      site-header.js
      site-header-client.js
      testimonials.js
      tutor-preview.js
    student/
      ai-tutor-workspace.js
      student-portal-shell.js
      student-components.js
      student-charts.js
      student-forms.js
      learning-components.js
      lesson-player.js
    instructor/
      instructor-components.js
      instructor-forms.js
      course-cover-uploader.js
    payments/
      razorpay-checkout-button.js
      course-payment-reconcile-form.js
      subscription-cancel-form.js
      subscription-plan-form.js
      subscription-plan-deactivate-form.js
      subscription-plan-metadata-form.js
    layout/
      primitives.js
    shared/
      animations.js
      brand-mark.js
      entrance.js
      theme-provider.js
    ui/
      index.js
      button.js
      form-controls.js
      badge.js
      card.js
      indicators.js
      feedback.js
      tabs.js
      dialog.js
      dropdown-menu.js
      breadcrumb.js
      theme-switcher.js
  lib/
    auth/
      paths.js
      session-errors.js
      server.js
    courses/
      data.js
      query.js
    student/
      data.js
      learning.js
      time.js
    ai-tutor/
      data.js
      prompts.js
      provider.js
      server.js
      validation.js
    instructor/
      data.js
    payments/
      actions.js
      admin.js
      format.js
      public.js
      razorpay.js
      student.js
      verification.js
    constants.js
    landing-content.js
    utils.js
    supabase/
      client.js
      env.js
      server.js
      service.js
  proxy.js
supabase/
  config.toml
  migrations/
    20261109000000_create_profiles_and_roles.sql
    20261109010000_create_learning_platform_schema.sql
    20261109020000_add_secure_learning_operations.sql
    20261109030000_add_marketplace_public_reads.sql
    20261109040000_add_student_learning_hub.sql
    20261109050000_add_lms_playback_and_completion.sql
    20261109060000_add_assessment_engine.sql
    20261109070000_add_instructor_workspace.sql
    20261109080000_add_instructor_question_editor.sql
    20261109090000_add_admin_workspace.sql
    20261109100000_add_razorpay_payment_lifecycle.sql
    20261109110000_subscription_plan_activation_and_payment_search.sql
    20261109120000_add_ai_language_tutor.sql
    20261109130000_add_phase_fourteen_workflows.sql
    20261109140000_harden_phase_fourteen_workflows.sql
    20261109150000_fix_certificate_revocation_reason.sql
    20261109160000_restrict_live_class_table_grants.sql
    20261110010000_assessment_certification_requirements.sql
    20261110020000_matching_assessment_questions.sql
    20261110030000_fix_certificate_eligibility_fields.sql
    20261110040000_question_bank_and_manual_assessment_review.sql
    20261110050000_validate_question_resource_metadata.sql
    20261110060000_course_authoring_and_publish_readiness.sql
    20261110070000_restrict_anon_learning_content_grants.sql
    20261110080000_harden_quiz_answer_access.sql
    20261110090000_restrict_direct_certificate_inserts.sql
    20261110100000_fix_course_readiness_and_reorder_guards.sql
    20261110110000_restrict_anon_learning_data_grants.sql
    20261110120000_remove_unused_admin_assessment_state.sql
    20261110170000_fix_lesson_rls_recursion.sql
    20261111010000_complete_assessment_authoring.sql
  tests/
    profiles_rls.test.sql
    learning_platform_rls.test.sql
    marketplace_public_access.test.sql
    student_learning_hub.test.sql
    student_lms.test.sql
    matching_assessment.test.sql
    assessment_authoring.test.sql
    assessment_certification.test.sql
    question_bank_and_review.test.sql
    phase_fourteen.test.sql
    instructor_workspace.test.sql
    admin_workspace.test.sql
    payment_lifecycle.test.sql
    ai_tutor.test.sql
tests/
  ai-tutor/validation.test.mjs
public/
.env.example
AUTHENTICATION_SETUP.md
PAYMENT_INTEGRATION.md
AI_TUTOR.md
ASSESSMENT_SYSTEM.md
CERTIFICATION_WORKFLOW.md
DATABASE_SCHEMA.md
DATABASE_SECURITY.md
COMPONENTS.md
FEATURE_STATUS.md
PROJECT_ARCHITECTURE.md
PROJECT_MASTER_PLAN.md
```

Reusable primitives are exported from `components/ui`, shared presentation
and theme/motion providers live in `components/shared`, and landing-page
sections live in `components/landing`. Put reusable non-UI logic in `lib`; add
domain modules only when product features are built. Avoid empty directories
and abstractions before they have a use. See [COMPONENTS.md](./COMPONENTS.md)
for APIs and composition.

## Application architecture

The root layout owns document metadata, Geist fonts, global styles, the
pre-paint theme initialization script, and theme provider. The public home
page composes server-rendered marketing sections; its header obtains a
server-verified account snapshot. Authentication pages use Server Component
shells with client forms bound to server actions. Protected portal layouts
repeat server-side role verification, while `src/proxy.js` refreshes Supabase
cookies and rejects unauthenticated or mismatched roles before routing.
`/student` and its learning, progress, activity, profile, and settings routes
form a protected student workspace. Enrolled students navigate published
lessons through `/student/courses/[courseId]/learn`; lesson playback,
structured reading, private resources, and progress use a server-only data
layer plus narrowly scoped database functions. The protected instructor
workspace provides course drafts, curriculum editing, course-scoped roster
and analytics, assessment authoring and grading, profile, and settings views.
Course mutations authenticate and write through the same request-scoped
Supabase SSR client so role checks, refreshed cookies, and RLS use one session
context. Draft inserts return the persisted row ID; edits verify that an
owned editable row was actually returned before reporting success. Draft
inserts avoid `RETURNING` because it invokes the SELECT RLS policy within the
same statement; the action separately retrieves the row by slug and owner.
The protected admin workspace provides platform oversight and administration;
its routes and data boundaries are described under Phase 11 below.

Tailwind v4 is configured through `@import "tailwindcss"` and `@theme inline`
in `src/app/globals.css`; there is no separate Tailwind JavaScript config.
### Design system architecture

`globals.css` defines light, dark, and system color values as semantic CSS
variables and maps them to Tailwind v4's CSS-first theme. Tokens cover surfaces,
text, controls, focus rings, and success/warning/destructive/information states.
The type scale and spacing unit are defined alongside radius and shadow tokens.
Reusable component rules and responsive layout/showcase styles are in
`design-system.css`.

### Component organization

`components/ui` contains reusable buttons, form controls, cards, status,
indicator, feedback, navigation, and overlay components. The directory's
`index.js` exposes the documented public component API. Layout primitives are
in `components/layout/primitives.js`. The internal `/design-system` route
exercises component states and tokens and is set `noindex`. The public homepage
uses the same semantic tokens and UI primitives through `landing.css`; the
stylesheet adds responsive section layouts and illustration styling without
replacing the design-system token definitions.

### Theme architecture

`ThemeProvider` exposes `light`, `dark`, and `system` via a hydration-safe
external store. Preferences persist under `lingopro-theme`; the root layout
applies saved preferences with an early script, while CSS media queries resolve
system mode. A media-query listener tracks operating-system changes, and
`ThemeSwitcher` exposes all three modes. No theme dependency was added.

### Animation architecture

`components/shared/animations.js` provides fade-in, fade-up, scale-in, stagger,
hover-lift, tap, and page-transition primitives backed by Framer Motion. These
presets and the scroll-reveal/stagger wrappers respect reduced motion. Landing
sections use them for subtle entrance effects; FAQ disclosure motion also
respects the preference. `useReducedMotionPreference` applies the browser
preference after hydration so server-rendered animation state remains stable.

### Public website architecture

The root page composes the header, hero, language exploration, feature and
learning-journey sections, illustrative course and product previews, tutor
concept, pricing concepts, sample brand statements, FAQ, call to action, and
footer. The responsive stylesheet is isolated in `app/landing.css`.
`lib/landing-content.js` centralizes navigation, display copy, language and
course examples, proposed plan concepts, FAQs, and demo testimonial copy.
Selection and filtering in the illustrative homepage sections are local
presentation interactions only.

Tutor, testimonial, and public pricing examples on the homepage remain
illustrative; they are not connected to billing. Phase 12 adds separate
Razorpay checkout and subscription billing, but no AI tutor or customer review
system. Phase 6 adds a
separate `/courses`, `/courses/[slug]`, `/categories`, `/categories/[slug]`,
and `/instructors/[id]` marketplace backed by Supabase. The header now links
to real login and student
registration routes when signed out and to a server-resolved account menu when
signed in. The `/design-system` route remains separate and noindex.

## Supabase integration strategy

`src/lib/supabase/client.js` and `server.js` create clients on demand using
`@supabase/ssr`; the app shell never initializes a client without configured
credentials. Server actions and the callback route can write refreshed
cookies. Server Components use a read-only cookie adapter; `src/proxy.js`
handles refresh writes on requests.

The `profiles` table is provisioned by an `auth.users` trigger that always
assigns the `student` role. RLS permits a user to read their own profile and
update only `full_name`, `avatar_url`, and their own private `avatar_path`;
admins can read profiles but cannot
write role columns directly. A security-definer database function requires an
existing admin role before changing roles. `requireRole()` verifies the
authenticated user and database profile in protected layouts, independently
of proxy checks. Initial admin setup is a manual trusted SQL-editor procedure;
there is no public admin or instructor registration.

### Database architecture

Phase 5 adds ordered, additive PostgreSQL migrations for categories and
courses, sections and lessons, enrollments and progress, quizzes and grading,
plans, subscriptions and payments, certificates, notifications, live classes,
and platform settings. UUIDs, foreign keys, restrictive deletion rules,
currency minor units, constraints, and query-specific indexes define the
domain. Existing Phase 4 identity objects are reused; the applied Phase 4
migration is not rewritten.

RLS is enabled for every new public domain table. Security-definer helpers use
an empty fixed `search_path`, derive permissions from `profiles.role` and
course ownership, and are explicitly granted to required roles. Quiz answer
keys and scoring are protected by column grants and trusted RPCs; financial
state has no client write path; certificate issuance verifies completed
lesson progress; live-class meeting references are not directly selectable.
See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) and
[DATABASE_SECURITY.md](./DATABASE_SECURITY.md) for relationships, policies,
and operational contracts.

### Phase 6 marketplace architecture

The route group `app/(marketplace)` owns marketplace navigation and
responsive styles without changing the existing homepage layout. Pages use
Server Components and the existing SSR Supabase client. `lib/courses/query.js`
validates URL-driven search, category, language, difficulty, price, sort, and
page parameters. `lib/courses/data.js` calls bounded database search and
projection RPCs, uses direct RLS-protected reads only for the current
student's enrollment, logs failed reads, and avoids browser-side full-catalog
fetching.

`search_published_courses` filters and sorts published courses in PostgreSQL,
returns a real count and one bounded page, and includes only public instructor
display fields. Search includes title, descriptions, language, and active
category names. `get_public_course_details`, `get_public_course_categories`,
`get_public_instructor_profile`, and `get_public_course_curriculum` provide
limited public projections while omitting email, lesson content, media paths,
and unpublished rows. The migration adds GIN indexes for the text-search
expressions. Search, filters, and pagination synchronize to the URL; mobile
filters use the existing accessible dialog. Course and instructor cards use
Framer Motion's reduced-motion-aware stagger helpers.

Free enrollment requires a verified Supabase user with the `student` database
role. The server action reads the published course price and existing
enrollment, then writes only through the user's normal Supabase client;
existing RLS verifies ownership, published/free status, and active enrollment
uniqueness. At Phase 6, paid-course purchase was unavailable; Phase 12 later
adds a separate trusted payment/enrollment flow. Phase 6 adds no
instructor authoring, admin UI, or lesson-player access.

### Phase 7 student workspace architecture

The `/student` layout verifies the student role on the server and renders
request-time data under `connection()` and Suspense boundaries. The shared
portal shell owns responsive navigation, mobile-drawer state, sidebar
collapse, account access, unread-notification affordances, and theme controls.
Student routes remain `noindex`; course cards link to a protected learning path
or the student's resume lesson.

`lib/student/data.js` centralizes authenticated, student-scoped reads through
the ordinary SSR Supabase client. It composes enrollment and published course
data, course progress, quiz results, certificates, notifications, and
timestamp-backed activity. `lib/student/time.js` converts IANA timezone
calendar dates to correct UTC ranges for daily and weekly goals and charts.
`app/student/actions.js` validates profile, goal, avatar-path, and
notification mutations on the server; RLS and narrowly scoped database
functions remain authoritative. Client components are limited to actual
interactive forms, private-avatar upload, the chart visualization, and
navigation controls. No page visit writes progress or constructs achievements.
The goal/activity/reporting schema and function contracts are documented in
[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) and
[DATABASE_SECURITY.md](./DATABASE_SECURITY.md).

### Phase 8 student learning workspace

The nested learning routes await Next.js request parameters and call
`lib/student/learning.js`, which requires the verified student identity, a
current enrollment, an accessible published course, and a published lesson.
The module reads the ordered curriculum and learner-owned progress, validates
media sources, and signs private media and resource paths for a short period
on the server. Lesson JSON is rendered as an allowlisted set of React text and
semantic blocks; it is never injected as HTML.

`LessonPlayer` supports native video/audio files and approved YouTube videos.
It restores the saved position, reports playback periodically and on pause,
and surfaces synchronization or media errors. `record_lesson_access`,
`record_lesson_playback_position`, and `complete_lesson` are the only student
progress write paths. The playback RPC bounds forward progress by elapsed
server time, preserves a separate furthest position when a learner seeks
backward, and requires at least 90% of a known media duration before
media-based completion. The explicit manual completion action remains
available for reading and learner-controlled completion.
`get_student_course_resume` projects an in-progress or next unstarted lesson
for dashboard and course-card navigation.

The Phase 8 migration also limits private lesson-resource table and Storage
reads to published lessons and enrolled learners. See the Phase 8 database
and trust-boundary details in [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) and
[DATABASE_SECURITY.md](./DATABASE_SECURITY.md). Instructor authoring,
payments, and administrator workflows remain outside the student workspace.

### Phase 9 assessment system

The student assessment routes live under `app/student/assessments` and are
protected by the existing student layout. `lib/student/assessments.js` reads
published assessments and learner-owned attempts through the ordinary SSR
Supabase client. `components/student/assessment-attempt.js` provides the
interactive attempt experience; server actions validate identifiers and send
answer mutations to trusted PostgreSQL functions. The assessment list,
history, detail, attempt, and result routes share those data and action
boundaries.

The existing quiz schema is extended rather than replaced. Instructor data
reads select explicitly granted question columns directly; they do not embed
the restricted question tables through a quiz relation. Draft authoring
supports add/edit/delete, safe reordering, learner preview, question-bank
reuse, and the existing auto/manual grading modes. Short- and long-answer
questions use manual review. The assessment migrations add practice/exam
configuration, scoped course/lesson/module/final assessments, persisted
per-attempt question and option ordering, question flags, accepted fill-in
answers, matching pairs, partial/negative grading, and review controls. Start, save, submit, and
student-result operations validate role, ownership, enrollment, question
membership, option IDs, availability, and database deadlines. Matching answer
keys stay out of student-readable columns; the attempt RPC supplies only the
answer choices, and grading compares learner pairings in PostgreSQL.
Student response writes no longer use direct table grants. Results and
answer-key projections are separate: correct options and explanations appear
only when the assessment's review settings permit them.

Course managers configure certificate requirements per course. A database
eligibility operation reports lesson completion, required-assessment outcomes,
and final-exam status. Module and final assessment prerequisites are enforced
when attempts start, course completion uses those same rules, and certificate
claims are idempotent and revalidated server-side.

Course managers can reuse questions in a course-scoped bank (maximum 500
items) and import snapshots into unpublished assessments (maximum 100
questions per assessment). Questions may include optional difficulty and up
to five HTTPS learning resources. Administrator attempt review is manual:
flag/clear decisions require a reason and are retained in a private audit
history; no automated suspicion rules are applied.

Assessment links are available from the student navigation, dashboard, course
overview, and matching lesson workspace. Existing quiz aggregates remain the
source for the dashboard's quiz average and activity. Instructor assessment
authoring and administrator oversight/unpublishing/manual-attempt-review tools
are implemented in their respective workspaces. A submit-for-review,
approve/reject queue is not currently part of the assessment publication
model. Billing, AI, live classes, and unrelated later-phase workflows remain
separate.

### Phase 10 instructor workspace

The instructor layout uses the shared responsive portal shell but supplies
role-specific navigation and data. Routes cover the overview, course list and
draft editor, curriculum, course roster, assessments, profile, and settings.
Server Components read through `src/lib/instructor/data.js`; mutations are
server actions in `src/app/instructor/actions.js`. Each action independently
verifies the instructor role and course ownership, while RLS remains the
database authorization boundary.

Course changes remain drafts or review-pending; only administrators publish
or archive courses. Curriculum supports editable structured JSON lesson
blocks, safe HTTPS media/resource links, and database-validated ordering.
Course authoring also captures learning outcomes, prerequisites, and target
audience and uploads course covers through the existing ownership-scoped
`course-thumbnails` bucket. Lesson-media uploads remain out of scope; existing
lesson Storage paths are preserved and external links are validated.
Publishing is database-guarded until every section has a published, content-
ready lesson.
Instructor roster data comes only from `get_course_student_roster`, which
does not reveal learner email or payment data. Assessment answer keys are read
through the manager-only RPC, and question plus option edits are performed
atomically by `save_instructor_quiz_question`; publication and post-attempt
immutability remain enforced in PostgreSQL.
Course data reads accept page-specific inclusion options: curriculum, assessment
creation, and assessment-list pages skip unrelated categories, rosters, progress,
answer keys, and/or learner responses. Answer keys and response rows are fetched
only by the assessment management view that needs them.

The Phase 10 migrations add reorder RPCs with exact-set validation and an
atomic question editor. The local Supabase test suite verifies course
readiness, instructor ownership, ordering, and assessment edit locks.
An authenticated production instructor verified course creation, refresh/list,
editing, section/lesson authoring, and submission for review. Course publication
remains administrator-controlled; administrator review and student enrollment
still require their respective active browser sessions.

### Phase 11 administrator workspace

The administrator route group is server-gated by the verified profile role
and reuses the portal shell with administrator-specific navigation. Routes
cover the platform overview, user and instructor directories/details, course
moderation and curriculum review, categories, assessment oversight, reports,
audit history, settings, and the current administrator profile. The application
does not contain an instructor-application model or Auth-user suspension API;
those actions are not simulated.

Platform aggregates and paginated user/course/assessment lists are returned by
narrow `SECURITY DEFINER` functions that check the authoritative admin profile.
Role changes use the trusted role RPC; course moderation and assessment
unpublishing use transactional RPCs. The additive Phase 11 migration adds an
append-only, admin-readable audit table and triggers for role, course status,
category, assessment publication, and setting changes. Moderation records
include a required reason. Existing notification infrastructure sends
in-app updates to affected instructors/account holders. Moderation preserves
course, enrollment, progress, and assessment-attempt records; archived
published courses remain accessible to eligible existing learners.

Reports use database aggregates and actual enrollment, course, role, progress,
and attempt records. Learner-level details and assessment answer data are
excluded from reporting and assessment oversight projections. The platform
settings screen stores the existing generic settings model, rejects
credential/payment-like keys, and clearly indicates that unused keys do not
change runtime behavior.

The Phase 11 implementation adds `/admin/**` management routes and
`20261109090000_add_admin_workspace.sql`. Its transactional pgTAP suite and
the broader local Supabase regression suite pass. Authenticated admin browser
workflows against a configured project remain unverified.

### Course authoring and database hardening

The course-authoring migrations add learning outcomes, prerequisites, target
audience, a course-cover upload path, and a database publication-readiness
guard. They also remove anonymous grants from private learning tables, revoke
table-wide quiz-question reads while preserving safe column grants, restrict
direct certificate inserts, and fix assessment mutation locks and instructor
reordering under fixed `search_path` functions. All 14 local Supabase database
test files pass (348 assertions); hosted and authenticated browser workflows
remain pending.

The hosted project now contains one approved recovery course in `PENDING_REVIEW`,
one section, and one published text lesson; it has no enrollments or
certificates. The admin course-list RPC returns all statuses by default and has
no instructor-only filter, but its authenticated UI was not verified because
the browser remained signed in as the instructor. The course insert was fixed
by separating the insert from the owner-scoped confirmation read. Lesson
creation's `42P17` RLS recursion was fixed with the
`20261110170000_fix_lesson_rls_recursion.sql` helper/policy change; RLS remains
enabled. The instructor course list also now maps the selected category
relation for display.

The certificate oversight query explicitly selects the student and course
foreign keys. It now fetches audit events only for returned certificate IDs
and skips that query when the result is empty. This fixes the
`PGRST201` relationship ambiguity without changing certificate data or RLS.
The equivalent hosted PostgREST embed was checked with a zero-row limit and
returned successfully; the production certificate page still requires an
authenticated admin browser check.

The hosted Supabase Auth health endpoint returned HTTP 200 during this audit;
the earlier `AuthRetryableFetchError` was not reproducible. Anonymous profile
reads remain denied by RLS as expected. A build exposed a separate Next.js 16
issue: auth and public-data catches converted the framework's prerender-time
`cookies()` control-flow rejection into false Supabase-unavailable errors.
Those boundaries now call `unstable_rethrow`; the subsequent build generated
all 72 routes without Auth, cookie, or `Date.now()` prerender errors. The
earlier development `Date.now()` warning had no captured stack and was not
reproduced, so its exact historical source remains unconfirmed.

### Phase 12 payment architecture

The additive `20261109100000_add_razorpay_payment_lifecycle.sql` and
`20261109110000_subscription_plan_activation_and_payment_search.sql` migrations
extends the existing payment model with course purchase references, unique
idempotency and receipt identifiers, explicit finite subscription terms,
Razorpay plan/mode references, provider-state snapshots, and trusted
transactional RPCs. Existing payment history is linked back to its course via
the enrollment relation; applied migrations are not rewritten.

`src/lib/payments/actions.js` owns student-only checkout, provider verification,
and subscription cancellation. Course order amounts are read from the published
course row; paid enrollments are created only after the Razorpay payment is
verified as captured. Subscription plans require an explicitly configured
price, currency, interval, and finite cycle count; a paid subscription does not
silently grant course entitlements because the data model defines no such
relationship. The official Razorpay SDK runs only on the server. Browser
checkout receives only the public key ID and provider-generated order or
subscription reference.

`/api/razorpay/webhook` validates Razorpay's signature against the exact,
bounded raw request body, records the unique event ID, and delegates to a
service-role-only database function. Webhook events are idempotent and
timestamp-ordered; retries of failed events are permitted. A server-only
Supabase service client performs trusted writes and is never imported into
client components. `/student/subscription`, `/student/transactions`, and
`/admin/payments`/`/admin/subscriptions` expose role-scoped billing records.
The printable receipt route is owner/admin gated and explicitly does not
claim to be a tax invoice. Homepage pricing reads only active, checkout-ready
plans from Supabase; it distinguishes missing configuration, unavailable
database, and no active plans. New plans default inactive, and administrators
must explicitly activate valid finite billing terms. Plan edits are limited to
display metadata so existing provider terms and transaction snapshots remain
unchanged. Student transaction history is paginated.

See [PAYMENT_INTEGRATION.md](./PAYMENT_INTEGRATION.md) for Test Mode setup,
webhook configuration, supported lifecycle events, and the remaining
provider/Supabase verification requirements.

### Phase 13 AI tutor architecture

The protected `/student/ai-tutor` route loads only the signed-in student's
conversations, messages, and saved vocabulary through the user-scoped Supabase
SSR client. Route handlers verify the student's role, validate same-origin
mutations and bounded JSON input, and rely on PostgreSQL RLS for record
ownership. No service-role key is used for tutor data.

The server-only `src/lib/ai-tutor/provider.js` calls the official Gemini
Interactions API with `store: false`, a bounded output, an abort/timeout
signal, and the server-only `GEMINI_API_KEY`. Model mode, language, and CEFR
level select trusted tutor instructions. Only the current conversation's
bounded recent text, selected learning language, level, mode, and optional
topic are sent to Gemini; profile, course, and billing data are not included.
The model is not given database tools or other capabilities.

Conversation content is stored by LingoPro until a student deletes it.
Students can delete conversations (including messages) and saved vocabulary.
The database stores only one per-student UTC-day quota row, and an atomic
security-definer function enforces 20 requests per day. The function exposes
no usage-history read API. Gemini requests and their stored LingoPro responses
are not live-verified until a configured key and Supabase project are used.

### Phase 14 certificates, live classes, and notifications

Certificate claims use the transactional `issue_course_certificate` RPC,
which verifies completed lessons and required assessments before recording
issuance. Managers can revoke certificates with a required reason; lifecycle
events preserve the audit trail without exposing the reason through the public
verification RPC. Students download generated PDFs only after the API route
checks their role and certificate ownership. `/verify/[verificationCode]`
shows the public authenticity/status result and is excluded from indexing.

Live-class discovery and roster reads are role-scoped. Students register
through a capacity- and schedule-conflict-checked transaction; meeting
credentials are omitted from direct table reads and returned only by an
authorization-checked RPC. Instructors may record attendance after a class
ends, and an append-only event table supports admin review. Meeting links are
host-supplied and explicitly unverified; no video-provider provisioning or
attendance integration is configured.

Notification preferences are private to each user and control in-app messages
for course, assessment, certificate, live-class, and billing events. Workflow
triggers create notifications inside the same database transaction. Users can
read their own notification content and change their own read state; admins
cannot read another user's notification message. Portal unread counts refresh
with Realtime and polling fallback. Email, push, and timed reminders are not
configured.

The Phase 14 workflow migrations are
`20261109130000_add_phase_fourteen_workflows.sql`,
`20261109140000_harden_phase_fourteen_workflows.sql`,
`20261109150000_fix_certificate_revocation_reason.sql`, and
`20261109160000_restrict_live_class_table_grants.sql`. The 29-assertion
workflow suite and two PDF-generation tests pass; the full local Supabase
database suite also passes all 14 files and 348 assertions. Authenticated
browser/provider workflows remain unverified.

### Storage architecture

Storage bucket declarations are migration-managed and do not overwrite
existing same-named bucket settings. Public reads are limited to course
thumbnails. Lesson media, learning resources, avatars, and certificates use
private buckets with course/lesson/user/certificate-scoped object paths and
RLS policies. Meeting credentials and private object paths are never public.
Large or adaptive video should use a dedicated streaming provider. Deployed
bucket flags and limits must be audited before applying migrations.

Copy `.env.example` to `.env.local`. Set the public Supabase URL/key and the
server-only canonical `APP_BASE_URL` in production. The application remains
available without credentials; authentication routes report their
configuration state and never simulate a session. The current local Supabase
stack has all repository migrations applied and passes the complete 14-file,
348-assertion database suite. Hosted-project and authenticated browser
verification remain pending. See
[AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md) for migrations,
redirects, email settings, operator provisioning, and test procedures.

## Security principles

- Never put a Supabase service-role key in browser code or a `NEXT_PUBLIC_*`
  variable.
- Keep local secrets in ignored `.env.local`; commit only the blank example.
- Validate required configuration at the point a client is created.
- Enforce authorization in protected server layouts and database Row Level
  Security; proxy checks and hidden UI are additional layers, not substitutes.
- Role claims in user-editable metadata are never used for authorization.
- Do not claim live-provider workflow verification until run against a
  configured Supabase project.

## Future module organization

As the roadmap advances, group domain logic by bounded feature: student
learning, instructor content, admin operations, subscriptions, notifications,
and shared media. Keep route handlers and server actions near their owning
feature, centralize shared Supabase setup in `lib/supabase`, and share only
stable UI in `components`. Add hooks for genuinely reusable client-side state.
Authentication and authorization must precede protected product modules.
