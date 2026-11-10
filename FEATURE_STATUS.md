# LingoPro Feature Status

Phases 1–3 are complete. Phases 4–14 have existing implementations and prior
local database regression results (14 files, 348 assertions). This pass
verified the instructor course lifecycle through submission for review and
applied focused production fixes for lesson RLS and automatic certificate
issuance. The certificate-focused local database suites passed 68 assertions
across three files. The full database run still fails in the separate
assessment-authoring suite because of a `quiz_questions` permission error and
a missing authoring function. ESLint and the production build pass. Production
now contains the genuinely issued certificate for the eligible learner;
student/admin UI verification remains pending their authenticated sessions.
Phases 15–16 have not started.

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, application shell, Supabase client setup, and project documentation | Complete |
| 2 | Premium design system, theme architecture, reusable components, and internal showcase | Complete |
| 3 | Responsive public website, product overview, and illustrative experience previews | Complete |
| 4 | Authentication, account security, and role-aware access | Implemented; local database checks pass; configured-account browser verification pending |
| 5 | PostgreSQL database architecture, RLS, trusted operations, and Storage foundation | Implemented; production lesson-recursion RLS fix applied; expanded local database test pending Docker |
| 6 | Database-connected course marketplace, search, filters, course details, public instructor profiles, and free enrollment | Implemented; pending-review course correctly remains absent from the public catalog; free enrollment awaits admin publication and student session |
| 7 | Protected student learning hub, progress, goals, activity, profile, and notifications | Implemented; local Supabase tests pass; authenticated browser verification pending |
| 8 | Student learning workspace, lesson navigation, authorized media/resources, and progress persistence | Implemented; production lesson content exists; student lesson access and progress persistence not yet verified |
| 9 | Interactive practice, quizzes, assessments, and certification eligibility | Implemented; local Supabase regression tests pass; authenticated assessment workflows pending |
| 10 | Instructor workspace and course management | Authenticated production workflow verified: create, refresh/list, edit, section/lesson creation, and submit for review; admin publication pending |
| 11 | Administrative workspace and platform operations | Implemented; admin course RPC includes all statuses, but browser moderation remains blocked until an administrator session is active |
| 12 | Subscription plans, checkout, and billing lifecycle | Implemented; local Supabase tests pass; hosted setup and Razorpay Test Mode verification pending |
| 13 | AI language tutor, practice modes, conversations, and saved vocabulary | Implemented; local Supabase tests pass; Gemini and hosted-project verification pending |
| 14 | Certificates, live classes, and notifications | Automatic certificate issuance verified in local tests and production database; student/admin UI and external-provider workflows remain pending |
| 15 | Cross-platform testing, accessibility, and security hardening | Pending |
| 16 | Production deployment, monitoring, and operational readiness | Pending |

Phase 3 is a public-facing product overview, not an operational learning
platform. Language/course choices are illustrative; tutor, course, progress,
milestone, plan, and testimonial examples are clearly labeled concepts.

Phase 4 adds real Supabase Auth flows, profile provisioning, server-side role
checks, and RLS. Its configured-account end-to-end authentication test remains
pending. Phase 5 adds the platform schema, RLS, trusted database operations,
and Storage policies. The local Supabase stack now applies the migrations and
passes the complete transactional database suite, including Storage access
assertions. Hosted-project configuration and real account workflows remain
separate verification steps. Phase 6 provides database-backed public search,
filters, details, categories, instructor profiles, and protected free
enrollment. Its 31 assertions pass locally; the catalog currently has no
published courses or active categories in the local test database, and no fake
content has been seeded. The hosted database has one active category but no
courses.
Phase 7 adds the student learning hub, goals, timezone-aware activity,
progress, notifications, profile updates, and settings. Phase 8 adds protected
lesson navigation, media/resource access, playback progress, explicit
completion, and resume links. Their 16- and 25-assertion suites pass as part
of the full local database run. Browser checks of authenticated flows still
require configured test accounts and valid media.

Phase 9 adds protected student assessment list, detail, attempt, result, and
history routes; autosaved responses and flags; persisted question/option
ordering; server-enforced availability and deadlines; automatic and manual
grading; result review controls; and links from student navigation, dashboard,
course, and lesson views. Question types include single choice, multiple
select, true/false, fill-in, short answer, long answer, and matching. Matching keys remain
server-side and are graded in PostgreSQL. Course completion and certificate
eligibility honor configurable lesson percentages, required assessments,
and final-exam minimum scores. Automatic issuance is implemented in migration
`20261111020000_automatic_certificate_issuance.sql`; the updated database tests
are pending because the local Docker/Supabase stack is unavailable. The LMS
regression suite (25 assertions) and Phase 14 regression suite (29 assertions)
also pass. Instructor-managed course question banks support up to 500
reusable questions, assessments are capped at 100 questions, and questions can
carry difficulty and HTTPS resource metadata. Administrators can manually
flag or clear submitted attempts with an audited reason; no automated
suspicion heuristics are applied. The bank/manual-review suite passes 21
assertions. The instructor draft-detail crash was reproduced in the
authenticated browser: PostgreSQL returned `42501 permission denied for table
quiz_questions` because the hardening migration intentionally removed
table-wide SELECT while several queries still embedded question tables.
Instructor/student reads now use explicitly granted question columns directly.
A forward-only migration adds atomic question reordering and distinct, manually
graded long answers. These assessment changes still require the new migration
to be applied and the authoring, student attempt, and moderation browser
workflows to be re-tested; the local Supabase test suite was unavailable
because Docker/Postgres was not running. Assessment publication is currently
instructor-controlled after database validation; the admin workspace can
unpublish and review attempts but does not yet provide instructor submission,
approval, or rejection of assessment content.

Phase 10 adds a protected instructor workspace, course and curriculum
authoring, safe reordering, learner roster/progress, assessment authoring and
grading, profile/settings, learning outcomes/prerequisites/audience fields,
and course-cover uploads. Lesson-media uploads are not implemented; video and
audio sources must currently be external HTTPS URLs, and text lessons use the
structured content editor. Dedicated writing/speaking assignment submission
and review workflows and course-level vocabulary flashcard/review workflows
are also not implemented. Course publishing remains admin-controlled and is
blocked until every section has a published, content-ready lesson. Local
instructor and readiness suites passed previously; the added direct RLS
assertions and authenticated authoring workflow remain unverified.

Phase 11 adds the server-gated admin overview, user/instructor management,
course/curriculum moderation, categories, assessment oversight, reports,
audit history, and platform settings. Role and moderation RPCs enforce
authorization and record audited decisions. Account suspension and instructor
applications are not supported and are not simulated. The 28-assertion admin
suite and all other local Supabase database suites pass; authenticated admin
moderation workflows remain unverified.

Phase 12 adds Razorpay course orders and finite subscription plans; callback
signature and provider-state verification; idempotent, raw-body-verified
webhook processing; trusted payment/enrollment RPCs; student subscription and
transaction pages; owner/admin printable receipts; and admin payment and plan
views. Paid course enrollment is activated only after a captured provider
payment matches the server-stored amount, currency, student, and course.
Subscriptions require an administrator-configured price, currency, billing
interval, and finite cycle count. They do not grant course entitlements because
the current schema contains no subscription-to-course entitlement mapping.
Public pricing now reads active checkout-ready plans from Supabase; new plans
are inactive until explicitly activated, and their billing terms cannot be
silently edited. Student transaction history is paginated. Optional receipt
branding is configurable without asserting tax compliance.
Four payment signature/currency unit tests pass. All 37 payment lifecycle
assertions pass as part of the full local Supabase database suite. The
production build succeeds. No Razorpay Test Mode payment or webhook has been
exercised; deployment setup is documented in
[PAYMENT_INTEGRATION.md](./PAYMENT_INTEGRATION.md).

Phase 13 adds `/student/ai-tutor`, six mode-specific Gemini learning
experiences, server-side input validation and request limits, authenticated
conversation/message persistence, student-owned saved vocabulary, RLS, and
conversation/vocabulary deletion. The official `@google/genai` Interactions
API is called only on the server with `store: false`; user content is not
included in application logs, and requests are limited to 20 per student per
UTC day. All six AI tutor unit tests pass; ESLint and the production build
pass. The additive migration applied successfully to the local Supabase
stack, and all 23 pgTAP ownership/quota assertions pass there. A Gemini key is
configured locally, but live generation, hosted migration/RLS, and
authenticated browser workflows are not verified. Phase 13 is implemented
but not complete pending those checks.

Phase 14 adds certificate revocation, public status verification and
owner-authorized PDF downloads. Automatic certificate completion/issuance
passes the focused local tests and the production migration/backfill issued
the eligible learner's certificate. Student Achievements, PDF download,
public verification, admin registry, and revocation remain unverified in
authenticated browser sessions. Capacity-safe live-class
registration, private meeting-link retrieval, instructor attendance recording,
and admin attendance history; and per-user notification preferences plus
in-app workflow notifications. Host-provided meeting links are not provider
verified; Zoom/Meet provisioning, provider attendance, email, push, and timed
reminders are not configured. A full local database run still has an unrelated
assessment-authoring failure; certificate, Phase 14, student-learning-hub,
and lesson RLS suites passed.
Authenticated student/instructor/admin journeys and external-provider
workflows remain unverified.

## Latest verification

- **Hosted certificate state:** `English Foundations: Beginner to Confident
  Speaker` is published with 16 published lessons, all 16 completed by its
  learner, and a graded 27/30 (90%) assessment against a 70% pass threshold.
  The course requires 100% lesson completion and required assessments, but
  does not require a separate final exam. Production now contains one
  `ISSUED` certificate for that learner; its enrollment is `COMPLETED`, the
  student/course relationships match, and no duplicate exists for the
  enrollment. The root cause was the old manual completion/certificate-request
  flow, which left an eligible enrollment `ACTIVE`.
- **Hosted migration/policy check:** migration
  `20261111020000_automatic_certificate_issuance.sql` is recorded remotely.
  Production `courses` policies
  require the authenticated instructor ID to equal `instructor_id`, the
  profile role to be `instructor`, draft status, and null publication time.
  Draft creation now inserts without `RETURNING` and verifies the record in a
  separate owner-scoped read; the authenticated browser test returned course
  ID `571336ac-5039-4ec7-b897-ed0e903795c0` and production SQL confirmed the
  instructor owner, free price, selected category, and `DRAFT` state.
- **Instructor course workflow:** the real instructor created the approved
  course, refreshed My Courses and found it, edited it and confirmed the same
  ID persisted, created a section and published text lesson, and submitted the
  course for review. Production SQL confirmed `PENDING_REVIEW` and null
  `published_at`. The instructor list initially rendered the selected
  category as “Uncategorized”; relation mapping was fixed and the rebuilt
  list now displays `languagenext`.
- **Lesson RLS root cause/fix:** lesson creation initially failed with
  SQLSTATE `42P17`, `infinite recursion detected in policy for relation
  "lessons"`. The lesson write check queried sections under a preview-aware
  section SELECT policy that also queried lessons. Migration
  `20261110170000_fix_lesson_rls_recursion.sql` adds a fixed-search-path
  `SECURITY DEFINER` ownership helper and updates the lesson policy without
  disabling RLS. The same authenticated instructor then created the lesson;
  its section/course links, structured text content, and published flag were
  confirmed from production.
- **Course insert root cause:** the previous action combined INSERT with
  `.select("id")`, causing a same-statement SELECT-policy check and SQLSTATE
  `42501`. Splitting the insert and the owner-scoped verification read fixed
  the real save under the unchanged deployed ownership policy. The old
  production process was a stale `npm run start` build, so the exact original
  PostgREST error text was not captured.
- **Regression tests:** the SQL suite now asserts owned course
  insert/retrieval, owned lesson insert/retrieval, and cross-owner denials.
  The local Supabase stack was unavailable because Docker was not running;
  these expanded pgTAP assertions remain unexecuted.
- **Admin data functions:** inspected the deployed dashboard and course-list
  RPC definitions; they count `profiles`, `courses`, `enrollments`, and
  published `lessons`, and the course list returns all statuses by default
  without an instructor-only filter. The RPCs were not invoked with an admin
  session. `/admin/courses` redirected the active instructor to `/instructor`,
  so admin draft visibility and publication remain blocked on an administrator
  sign-in.
- **Certificate relationship:** the ambiguous `profiles` embed is fixed by
  naming the student/course foreign keys in the admin and download queries.
  The original download select was reproduced as PostgREST `PGRST201` / HTTP
  300 because profiles relate through both student and revoker FKs. The
  corrected query resolves with HTTP 200. The learner Achievements page,
  public verification, and admin registry are reported to show the issued
  production certificate. The PDF is generated on demand as A4 landscape;
  its generated output parses as PDF and renders in Chrome. A real authenticated
  owner download, Preview opening, cross-student denial, and revoked-record
  denial remain pending the learner/admin browser sessions. The route fix is
  not deployed, so the hosted application still needs an app deployment to
  receive it.
- **Supabase connectivity:** the configured Auth health endpoint returned
  HTTP 200 and anonymous catalog reads succeeded. The previous
  `AuthRetryableFetchError` could not be reproduced; anonymous profile reads
  return 401 under the expected RLS policy. No real session was available to
  verify sign-in, cookie refresh, or role routing.
- **Next.js 16 rendering:** a build exposed that auth/public-data catch blocks
  were converting Next's prerender-time `cookies()` control-flow rejection
  into false Supabase-unavailable errors. Added `unstable_rethrow` at those
  boundaries. The subsequent build generated all 72 routes without Auth,
  cookie, or `Date.now()` prerender errors. The earlier development
  `Date.now()` warning has no application stack and was not reproduced by the
  current production build. The archived development log did contain
  `ERR_STREAM_DESTROYED` messages immediately after those old prerender errors,
  also without an application stack. Fresh route smoke requests added no new
  runtime errors to that log, so the historical stream failure cannot be
  conclusively attributed to application code.
- `npm run lint`: passed.
- `npm run build`: passed; all 72 routes generated with Cache Components and
  no prerender error.
- Production server smoke checks: `/`, `/courses`, and `/categories`
  returned HTTP 200; protected certificate and course-authoring routes
  redirected unauthenticated requests to login.
- Browser check of the production homepage loaded successfully with no console
  or uncaught page errors.
- Certificate, payment, and AI tutor unit tests: 12 passed.
- Focused certificate pgTAP tests: 68 assertions passed across three files on
  the local Supabase stack. The full suite was rerun and fails only in the
  separate assessment-authoring suite (`quiz_questions` permission denied,
  then missing authoring function); certificate, Phase 14, student-learning
  hub, and lesson RLS suites pass. The earlier 14-file, 348-assertion pass
  predates the latest certificate changes.
- `supabase db lint`: passed with one non-blocking warning for an unused
  `accepted_answer` variable in `submit_quiz_attempt`.
- Admin review/publication and student login, free enrollment, lesson access,
  and progress persistence remain unverified. A premium listing/payment was
  not attempted; no paid test course or fake payment was created. Browser
  cross-user isolation and external-provider journeys also remain unverified.
