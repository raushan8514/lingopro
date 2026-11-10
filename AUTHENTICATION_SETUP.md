# Authentication Setup

Phase 4 uses Supabase Auth, PostgreSQL, and Row Level Security. Authentication
is real only when the application is connected to a configured Supabase
project; missing credentials do not create a local or simulated session.

## 1. Configure the application

Copy `.env.example` to `.env.local` and set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
APP_BASE_URL=http://localhost:3000
```

In production, set `APP_BASE_URL` to the canonical HTTPS origin of the
deployed app (for example `https://learn.example.com`). It is server-only and
must not include a path, query, or fragment. Never add a Supabase service-role
key to the app environment or browser code.

Set the `NEXT_PUBLIC_SUPABASE_*` values at build time as well as in the
deployment runtime; Next.js embeds public environment values into its client
bundle during the build.

The Supabase URL and publishable/anon key are public credentials. Keep
`.env.local` private; `.gitignore` already excludes it.

## 2. Configure Supabase Auth

In **Authentication → URL Configuration**:

- Set **Site URL** to the value of `APP_BASE_URL`.
- Add the exact redirect URL `${APP_BASE_URL}/auth/callback` to the redirect
  allow list. For local development, allow
  `http://localhost:3000/auth/callback`.
- For local testing with `127.0.0.1`, also allow
  `http://127.0.0.1:3000/auth/callback`.

Enable the email provider and email confirmations. Configure a production
SMTP provider before relying on verification or recovery email delivery; the
hosted project's Auth email settings and templates determine message delivery.
The local Supabase config enables email confirmation and captures local mail
in the Supabase development inbox instead of sending it externally.

The registration form creates only student accounts. The callback accepts
only same-site relative paths and validates the role against the database.
Password recovery returns through `/auth/callback` before opening
`/reset-password`.

## 3. Apply the database migration

The migration creates `public.profiles`, provisions existing email accounts
as students without trusting their role metadata, and adds trusted
profile/email triggers, RLS policies, and the administrator-only role-change
function. It does not delete or overwrite existing data.

For a linked hosted project:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Review the migration before applying it to production. It is safe to apply
once to a new project; Supabase migration tracking prevents reapplying the
same migration.

For a local Supabase stack, start Docker Desktop, then run:

```sh
supabase start
supabase status
supabase test db supabase/tests/profiles_rls.test.sql
```

For the local app, use the local API URL and publishable/anon key printed by
`supabase status`, and set `APP_BASE_URL=http://localhost:3000`. Never copy a
local or hosted service-role key into the app. Local confirmation emails can
be inspected in the Inbucket UI at `http://localhost:54324`.

The RLS test uses temporary database fixtures inside a transaction and rolls
them back. It checks student-default provisioning despite untrusted role
metadata, own-profile visibility, permitted profile edits, role-column
protection, instructor isolation, admin profile access and role assignment,
self-demotion protection, unsupported roles, and anonymous denial.

## 4. Provision the first administrator

There is no public admin signup or automatic first-user promotion. First
create a normal account, verify its email, then use the Supabase Dashboard's
SQL Editor with a trusted project-owner account to promote that exact,
verified identity:

```sql
update public.profiles as profile
set role = 'admin'
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = lower('operator@example.com')
  and auth_user.email_confirmed_at is not null
  and profile.role = 'student'
returning profile.id, profile.email, profile.role;
```

Confirm exactly one row was returned. If no row is returned, verify the email
and existing profile before retrying. Do not expose the SQL Editor or a
service-role key to application users.

After an administrator exists, `admin_set_user_role` is the only
application-granted role mutation path. The function independently checks
the caller's current database role. `src/app/admin/actions.js` adds a
server-side `requireRole("admin")` check before invoking it. Administrator
accounts cannot demote themselves through this function.

## 5. Provision instructors

Instructor access is not available during public registration. An applicant
can create and verify a student account; an existing administrator must then
approve the account by assigning the `instructor` role through the trusted
administrator operation. The role RPC and server action are ready for a
future admin interface; no instructor or admin dashboard is included in
Phase 4.

For an initial operator-led provisioning before that interface exists, use a
trusted Dashboard SQL Editor operation after verifying the target identity.
Never accept a role from a registration form, query parameter, or user-editable
metadata. Example for approving one verified student:

```sql
update public.profiles as profile
set role = 'instructor'
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = lower('instructor@example.com')
  and auth_user.email_confirmed_at is not null
  and profile.role = 'student'
returning profile.id, profile.email, profile.role;
```

## 6. Authentication routes and protections

- `/register`: server-validated student registration and confirmation notice.
- `/login`: password sign-in, session cookie restoration, and role-aware
  destination.
- `/forgot-password`: non-enumerating recovery request.
- `/auth/callback`: PKCE code exchange, safe internal redirect, and fixed
  error handling.
- `/reset-password`: requires a valid Supabase recovery session to update the
  password.
- `/student/*`, `/instructor/*`, `/admin/*`: session and database role checked
  in both `src/proxy.js` and their server layouts.

The proxy refreshes SSR session cookies. Protected layouts independently call
`auth.getUser()` and read the RLS-protected profile. RLS is the final data
boundary. Profile users can update `full_name`, `avatar_url`, and their own
`avatar_path` for the private avatar bucket; role updates are revoked at the
table-column level.

## 7. Verification checklist

Run `npm run lint` and `npm run build`, then configure a Supabase project and
complete these provider-backed checks:

1. Register a student and confirm the profile's role stays `student`.
2. Verify the email through `/auth/callback`.
3. Sign in, refresh, and sign out; confirm cookie restoration and clearing.
4. Reject invalid credentials and unverified email sign-ins.
5. Resend a verification email without revealing account existence.
6. Request and complete password recovery.
7. Check unauthenticated access redirects to login.
8. Check student → instructor/admin and instructor → admin access is denied.
9. Check users cannot change their own roles.
10. Run the RLS pgTAP test against the configured database.
11. Provision the first admin through the trusted SQL procedure and test an
    authorized role change.
12. Confirm an external redirect target is rejected by the callback.

Until Supabase credentials and the email provider are configured, provider
email delivery, real user lifecycle, and hosted-project RLS execution remain
unverified. Do not report those checks as passed.
