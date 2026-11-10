# LingoPro Project Master Plan

## Project overview

LingoPro is a premium language-learning and subscription platform intended to
help learners make steady, measurable progress through structured courses,
practice, and instructor-created content. Phases 1–3 established the
technical foundation, design system, and public product overview. Phase 4
introduces Supabase-backed authentication, profiles, and role enforcement.
Phase 5 establishes the PostgreSQL, RLS, and Storage foundation; Phase 6 adds
course discovery; Phase 7 adds the protected student learning hub; and Phase 8
adds the enrolled learner's lesson workspace and persisted playback progress.
Phase 9 adds student-facing quizzes and assessments with secure attempts,
autosave, grading, results, and history. Instructor and administrator
workspaces are implemented in later phases, and Phase 12 adds server-verified
Razorpay course payments and finite subscription billing. Phase 13 adds a
Gemini-backed language tutor with student-owned practice history and
vocabulary. Completion and verification state is tracked in
[FEATURE_STATUS.md](./FEATURE_STATUS.md).

## Roles

- **Student:** discovers learning paths, studies lessons, completes practice,
  tracks progress, and manages their account and subscription.
- **Instructor:** creates and maintains course content, reviews learner
  activity where permitted, and manages teaching materials.
- **Admin:** governs platform configuration, users, content, roles, and
  operational workflows under audited access controls.

Role capabilities must be enforced on the server and in the database, not only
through navigation or hidden UI.

## Core modules

1. Identity, profiles, and role-aware access.
2. Student learning workspace, goals, profile, progress, and activity.
3. Course catalog, enrollment, and learning paths.
4. Lessons, practice, and assessments.
5. Progress tracking and learning analytics.
6. Instructor content management.
7. Administrative platform management.
8. Plans, subscriptions, and billing.
9. AI language practice and saved vocabulary.
10. Notifications, media storage, and course discovery.
11. Public product information and discovery.

## Technology decisions

- Next.js App Router with React Server Components by default.
- JavaScript and JSX only; TypeScript is intentionally excluded.
- Tailwind CSS v4 for responsive styling and design tokens.
- Framer Motion for restrained interface motion; Lucide React for icons.
- Supabase PostgreSQL, Auth, and Storage for backend capabilities, integrated
  through the SSR-compatible Supabase clients. Ordered SQL migrations define
  the domain schema, RLS, trusted operations, and bucket policies; application
  data access is added with each feature phase.
- Razorpay's official Node SDK for server-side payment and subscription
  operations, and Google's official `@google/genai` SDK for server-side
  language-tutor requests. Provider secrets, the Gemini API key, and the
  Supabase service-role key remain server-only; no payment instrument data is
  stored by LingoPro.
- ESLint and npm for code quality and package management.
- Public Supabase URL and anonymous key are supplied through environment
  variables. Secrets and service-role credentials must remain server-only.

## Development roadmap

1. Project setup, application shell, and Supabase client foundation —
   **complete**.
2. Premium design tokens, theme system, reusable components, and internal
   component reference — **complete**.
3. Public website and product overview — **complete**.
4. Authentication, account security, and role-aware access — implementation
   added; configured-project verification is tracked in
   [FEATURE_STATUS.md](./FEATURE_STATUS.md).
5. PostgreSQL domain schema, RLS, trusted operations, and Storage foundation —
   implemented; database verification is tracked in
   [FEATURE_STATUS.md](./FEATURE_STATUS.md).
6. Database-connected course marketplace, course details, public instructor
   profiles, search/filter/pagination, and free enrollment; no payment gateway.
7. Protected student workspace with real progress, goals, activity,
   achievements, notifications, profile, and settings.
8. Student lesson workspace, lesson navigation, authorized media/resources,
   and persisted progress.
9. Interactive practice, quizzes, and assessments; implementation is present
   and verification is tracked in [FEATURE_STATUS.md](./FEATURE_STATUS.md).
10. Instructor workspace and course management.
11. Administrative workspace and platform operations.
12. Subscription plans, checkout, and billing lifecycle.
13. AI language tutor, practice modes, conversation history, and saved
    vocabulary; implementation is present and external Supabase/Gemini
    verification is tracked in [FEATURE_STATUS.md](./FEATURE_STATUS.md).
14. Notifications, media delivery, and course discovery.
15. Cross-platform testing, accessibility, and security hardening.
16. Production deployment, monitoring, and operational readiness.

See [FEATURE_STATUS.md](./FEATURE_STATUS.md) for phase tracking. The public
homepage explains the product direction; the separate Phase 6 marketplace
contains database-backed course discovery, and the Phase 7 student workspace
uses persisted learner records. Phase 8 adds student lesson consumption on
top of the existing published course structures; it does not add instructor
authoring. Phase 9 adds the student assessment lifecycle but intentionally
does not add instructor/admin dashboards. Phase 12 adds Razorpay checkout and
billing records; the current model does not make subscriptions course
entitlements. Phase 13 adds an authenticated Gemini tutor, with AI requests
limited to 20 per student per UTC day and no Google-side interaction storage.
Supabase and provider verification are tracked in
[FEATURE_STATUS.md](./FEATURE_STATUS.md) and
[PAYMENT_INTEGRATION.md](./PAYMENT_INTEGRATION.md) and
[AI_TUTOR.md](./AI_TUTOR.md).

The Phase 5–13 data contracts and policies are documented in
[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) and
[DATABASE_SECURITY.md](./DATABASE_SECURITY.md). Phase 5 establishes the
database foundation; Phase 6 exposes the published marketplace and free
enrollment; Phase 7 adds student-scoped reporting and learning preferences;
Phase 8 adds trusted lesson progress operations and private resource access;
Phase 9 adds trusted quiz/assessment operations. Supabase-backed workflow
verification is still required.

## Coding standards

- Build application code with `.js` and `.jsx` only.
- Prefer server rendering; add a client boundary only when browser-side
  interaction or animation requires it.
- Keep feature logic cohesive and shared utilities reusable without
  over-generalizing.
- Use semantic HTML, responsive layouts, accessible labels, and reduced-motion
  support.
- Validate configuration and input at trust boundaries; report errors
  explicitly.
- Never hardcode credentials, commit secrets, or expose private values through
  public environment variables.
- Do not add mock authentication, fake data services, or claims of backend
  connectivity.
- Run ESLint and a production build for meaningful application changes.
