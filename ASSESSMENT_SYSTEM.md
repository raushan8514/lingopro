# LingoPro Assessment System

## Scope and routes

Student assessment pages are server-rendered under
`src/app/student/assessments/`. Assessment authoring and course-specific
question-bank management are available to course managers from the instructor
workspace. Administrators can moderate publication and manually review
attempts from the admin workspace.

The assessment engine extends the shared `quizzes`, `quiz_questions`,
`question_options`, `quiz_attempts`, and `quiz_answers` schema. It does not
create a second quiz or assessment store.

## Question types

- Single choice and true/false: one server-verified correct option.
- Multiple select: exact set grading, with optional partial credit.
- Fill in the blank: case and whitespace settings plus accepted responses.
- Short answer: instructor-reviewed scoring.
- Matching: 2–20 unique prompt/answer pairs, with optional per-pair partial
  credit.

Matching answer keys are stored in the restricted question `answer_key`
column. The student attempt RPC returns answer choices without pair mappings;
the database validates learner selections and grades the mapping on
submission. Result responses disclose correct matches only when the assessment
allows result review and correct-answer display.

An assessment is limited to 100 questions. Courses can retain up to 500
reusable question-bank items; importing copies a snapshot into an unpublished
assessment and an item can be imported only once into a given assessment.
Questions may include an optional easy/medium/hard difficulty and up to five
HTTPS learning-resource links.

## Attempt lifecycle

1. `start_quiz_attempt` validates student role, course access, publication,
   schedule, attempt limit, and concurrent-attempt policy. It persists stable
   question and option ordering and the server deadline.
2. `save_quiz_answer` validates attempt ownership, deadline, question
   membership, response format, choice membership, and matching selection
   uniqueness. Learners cannot write answer rows directly.
3. `submit_quiz_attempt` performs objective grading in PostgreSQL, applies
   configured partial credit/negative marking, and routes manual answers to
   instructor review. Repeated submission returns the existing result.
4. `get_student_quiz_attempt` returns only the caller's attempt and applies
   configured result-review visibility.

Question content, scoring configuration, and placement are locked after the
first attempt so historic scoring cannot be changed underneath learners.

## Assessment placement and testing

Scopes are course-wide, lesson checkpoint, module, and final. Module attempts
require all published lessons in that section to be complete. Final attempts
require the course's configured lesson threshold and designated module
assessments to be passed.

Focused Supabase pgTAP coverage is in
`supabase/tests/matching_assessment.test.sql` and
`supabase/tests/assessment_certification.test.sql`; the LMS and Phase 14
regressions are in `supabase/tests/student_lms.test.sql` and
`supabase/tests/phase_fourteen.test.sql`. Bank access, metadata validation,
and manual admin review are covered by
`supabase/tests/question_bank_and_review.test.sql`.

## Manual attempt review

Administrators may manually flag or clear an attempt with a 3–1,000 character
reason. Current state and append-only decision history are restricted to
administrators. No automatic behavior or score-based suspicion labels are
generated. Authenticated browser workflows and timer behavior still require
end-to-end testing with configured accounts.
