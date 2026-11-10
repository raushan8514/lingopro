# LingoPro Certification Workflow

## Course policy

Each course can define its own certificate requirements in
`course_certificate_requirements`:

- Minimum percentage of published lessons completed.
- Whether designated/passing assessments are required.
- Whether a final assessment is required.
- Minimum score for the final assessment.

The database defaults are 100% published lessons, required assessments enabled,
no mandatory final exam, and a 70% final-exam minimum. Course managers update
the policy from the instructor course workspace.

## Eligibility and issuance

`get_course_certificate_eligibility` returns a role-checked projection with
lesson progress, required assessment progress, final-exam status, and overall
eligibility. A student can read only their own enrollment; that course's
managers and admins may also inspect it.

When a learner completes the configured requirements, database triggers
complete their active enrollment and issue the certificate in the same
transaction. The triggers reevaluate after lesson completion, assessment
grading, certificate-policy changes, and lesson or assessment publication
changes. A migration backfill applies the same checks to already eligible
enrollments. Issuance rechecks the policy while locking the enrollment and is
idempotent per enrollment; students have no executable issuance RPC and cannot
insert or edit certificate rows.

Revocation remains an administrator/course-manager action with a required
reason and append-only lifecycle history. Public verification discloses
certificate identity and validity status, not learner email, private storage
paths, or revocation reasons.

## Private PDF download

The student Achievements page downloads an issued certificate through
`/api/student/certificates/[certificateId]`. The route verifies the signed-in
student, scopes the query to that student's certificate, and rejects revoked
records. The PDF is generated on demand; no public storage URL is created.
The course and learner embeds use explicit foreign-key names because the
certificate has more than one relationship to profiles. Issue dates on the
student page, PDF, admin registry, and public verification page use the same
authoritative `issued_at` timestamp and render its UTC calendar date.

## Verification

`supabase/tests/assessment_certification.test.sql` covers configured lesson
thresholds, required module assessments, final-exam minimums, automatic
completion and issuance, duplicate prevention, access control, and student and
admin visibility. `supabase/tests/phase_fourteen.test.sql` covers revocation
and public verification, including revoked status.

## Current verification

Migration `20261111020000_automatic_certificate_issuance.sql` is applied in
production. Its backfill found the already-eligible learner enrollment,
transitioned it to `COMPLETED`, and created exactly one `ISSUED` certificate.
A read-only production query verified the enrollment/certificate student and
course relationships and duplicate count. The focused local certificate test
suites passed 68 assertions across three files. Student Achievements, PDF
download, public verification, and admin registry were subsequently reported
working except for the PDF download. The PDF route failure was reproduced as
PostgREST `PGRST201` / HTTP 300: its unqualified profile embed matched both
`certificates_student_id_fkey` and `certificates_revoked_by_fkey`. The query
now names the student and course foreign keys explicitly; the equivalent
PostgREST query returns HTTP 200. A generated A4 landscape PDF parses as a
valid PDF and renders in Chrome. A real authenticated owner download, Preview
opening, cross-student denial, and revoked-certificate denial still require
the corresponding live sessions. The application fix is in the workspace and
has not been deployed; the hosted download route remains unchanged until the
application is deployed.
