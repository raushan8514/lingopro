# AI Tutor Setup and Data Handling

## Configuration

The student-only `/student/ai-tutor` feature uses Google's official
`@google/genai` Node SDK and Interactions API. Apply the additive migration
through the project's normal Supabase migration workflow:

```bash
supabase db push
```

Set these variables in the server runtime or local `.env.local`:

```dotenv
GEMINI_API_KEY=your-server-only-key
GEMINI_MODEL=gemini-3.8-flash
```

`GEMINI_API_KEY` is never prefixed with `NEXT_PUBLIC_` and is never imported
by browser code. `GEMINI_MODEL` is optional and defaults to
`gemini-3.8-flash`. Supabase Auth and the Phase 13 migration must also be
configured. Without the Gemini key, the protected page explains why the tutor
is unavailable and the API refuses requests; it does not return simulated
answers.

## Tutor behavior and limits

- Modes: conversation, grammar, vocabulary, writing coach, interview
  practice, and daily practice.
- Learners choose a supported language and CEFR level from A1 through C2.
- Each request accepts at most 1,500 characters and includes at most the 12
  most recent conversation messages.
- Generated responses are capped at 700 tokens and provider requests time out
  after 25 seconds.
- A database function atomically limits each student to 20 requests per UTC
  day. Attempts that reach the quota receive an explicit rate-limit response.
- Students can delete conversations (including messages) and saved vocabulary.

## Privacy and security

The Interactions API request sets `store: false`, so LingoPro does not use
Google's stored-interaction history. Google still processes request content
under its current API terms and service configuration; `store: false` is not a
claim that provider processing or all provider-side retention is impossible.
Only the learner's bounded recent tutor messages and selected mode, language,
level, and topic are sent. LingoPro does not send profile, course, assessment,
or billing data. Avoid entering sensitive personal information.

LingoPro conversation and vocabulary records are stored in Supabase until
deleted by the student or account removal. Row Level Security enforces
student ownership. No service-role key is used for tutor data, and message
content is not written to application logs. Tutor output is rendered as plain
text, not HTML.

## Verification status

`npm run test:ai-tutor` covers request validation, content limits, supported
settings, and distinct mode instructions. `supabase/tests/ai_tutor.test.sql`
covers ownership policies and the database quota function. In this workspace,
the migration applied to the local Supabase stack and all 23 pgTAP assertions
passed. The six unit tests, ESLint, and production build also passed. These
checks do not verify Gemini credentials or provider behavior, a hosted
Supabase project's policies, or authenticated browser behavior. Those
external checks remain pending until a configured test project and API key
are available.
