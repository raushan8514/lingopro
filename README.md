# LingoPro

LingoPro is a language-learning platform built with the Next.js App Router.
The project includes its JavaScript application shell, design system,
Supabase-backed authentication foundation, course marketplace, protected
student learning workspace, and student quiz/assessment flows. Check
[FEATURE_STATUS.md](./FEATURE_STATUS.md) for implementation and verification
status by phase; Supabase-backed workflows still require configured
credentials and a running project.

## Getting started

Use Node.js 20.9 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Public pages work without
Supabase credentials. Set the Supabase URL and anonymous key in `.env.local`
to use authentication and student workflows; no service-role key belongs in
the browser. Marketplace results contain only real published courses; an
empty catalog means no eligible course content has been published yet.
Instructor course creation is restricted by the database to the authenticated
instructor profile and remains subject to RLS; see
[FEATURE_STATUS.md](./FEATURE_STATUS.md) for what has and has not been
verified with a real role session.

Instructor assessment drafts use the existing question and attempt tables.
Question authoring includes choice, true/false, fill-in, short/long answer,
and matching questions, with ordering and publication checks enforced by the
database. Apply pending migrations with the linked Supabase project before
using newly added question-authoring operations; never grant table-wide
question reads to make nested queries work.

## Payments and subscriptions

Phase 12 provides server-verified Razorpay course purchases, finite subscription
plans, webhook processing, transaction history, and private printable receipts.
Configure Razorpay Test Mode and the server-only Supabase service-role key
before enabling payment workflows. See
[PAYMENT_INTEGRATION.md](./PAYMENT_INTEGRATION.md) for environment variables,
migration and webhook setup, and the required Test Mode verification. A build
and local test suite do not substitute for the pending Supabase/Razorpay
integration checks; see [FEATURE_STATUS.md](./FEATURE_STATUS.md).

## AI language tutor

Phase 13 adds an authenticated, student-only AI tutor with six practice modes,
saved conversations, and personal vocabulary. It requires the additive
`20261109120000_add_ai_language_tutor.sql` migration, a configured Supabase
project, and the server-only `GEMINI_API_KEY`. Gemini interaction storage is
disabled; conversation history is stored in the student's own LingoPro
account and can be deleted from the tutor. See [AI_TUTOR.md](./AI_TUTOR.md)
for setup, rate limits, privacy, and remaining verification.

## Scripts

- `npm run dev` — start the development server.
- `npm run lint` — run ESLint.
- `npm run build` — create a production build.
- `npm run start` — serve a production build.
- `npm run test:payments` — run payment signature and currency-format tests.
- `npm run test:ai-tutor` — run tutor validation and mode-instruction tests.
- `npm run test:certificates` — run certificate PDF generation tests.
- `supabase test db` — run the local transactional database/RLS suites.

## Project references

- [Project master plan](./PROJECT_MASTER_PLAN.md)
- [Project architecture](./PROJECT_ARCHITECTURE.md)
- [Component reference](./COMPONENTS.md)
- [Feature status](./FEATURE_STATUS.md)

The internal, noindex component showcase is available at
`http://localhost:3000/design-system` while the development server is running.
