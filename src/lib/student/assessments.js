import "server-only";
import { notFound } from "next/navigation";
import { getStudentIdentity } from "@/lib/student/data";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logAssessmentReadFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

async function readAssessment(operation, request) {
  const { data, error } = await request;
  if (error) {
    logAssessmentReadFailure(operation, error);
    throw new Error(`Assessments could not load ${operation}.`);
  }
  return data;
}

async function createAssessmentContext() {
  const [identity, client] = await Promise.all([
    getStudentIdentity(),
    createClient({ allowCookieWrites: false }),
  ]);
  return { identity, client };
}

export async function getStudentAssessments() {
  const { identity, client } = await createAssessmentContext();
  const assessments = await readAssessment(
    "available assessments",
    client
      .from("quizzes")
      .select(
        "id,course_id,lesson_id,title,description,assessment_type,time_limit_seconds,passing_score,maximum_attempts,available_from,available_until,courses(title)",
      )
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
  );
  const questions = assessments.length
    ? await readAssessment(
        "assessment questions",
        client
          .from("quiz_questions")
          .select("id,quiz_id")
          .in("quiz_id", assessments.map((assessment) => assessment.id)),
      )
    : [];
  const questionCounts = new Map();
  for (const question of questions) {
    questionCounts.set(
      question.quiz_id,
      (questionCounts.get(question.quiz_id) || 0) + 1,
    );
  }
  const attempts = assessments.length
    ? await readAssessment(
        "your assessment attempts",
        client
          .from("quiz_attempts")
          .select("id,quiz_id,attempt_number,status,score,total_points,started_at,submitted_at,is_expired")
          .eq("student_id", identity.id)
          .in("quiz_id", assessments.map((assessment) => assessment.id))
          .order("created_at", { ascending: false }),
      )
    : [];
  const attemptsByQuiz = new Map();
  for (const attempt of attempts) {
    const previous = attemptsByQuiz.get(attempt.quiz_id) || [];
    previous.push(attempt);
    attemptsByQuiz.set(attempt.quiz_id, previous);
  }

  return assessments.map((assessment) => ({
    ...assessment,
    course: Array.isArray(assessment.courses)
      ? assessment.courses[0]
      : assessment.courses,
    questionCount: questionCounts.get(assessment.id) || 0,
    attempts: attemptsByQuiz.get(assessment.id) || [],
  }));
}

export async function getStudentAssessment(assessmentId) {
  if (!UUID_PATTERN.test(assessmentId || "")) notFound();
  const { identity, client } = await createAssessmentContext();
  const assessment = await readAssessment(
    "the assessment",
    client
      .from("quizzes")
      .select(
        "id,course_id,lesson_id,title,description,instructions,assessment_type,time_limit_seconds,passing_score,maximum_attempts,available_from,available_until,courses(title)",
      )
      .eq("id", assessmentId)
      .eq("is_published", true)
      .maybeSingle(),
  );
  if (!assessment) notFound();

  const [questions, attempts] = await Promise.all([
    readAssessment(
      "assessment questions",
      client
        .from("quiz_questions")
        .select("id,quiz_id,question_text,question_type,points,position")
        .eq("quiz_id", assessmentId)
        .order("position", { ascending: true }),
    ),
    readAssessment(
      "your assessment attempts",
      client
        .from("quiz_attempts")
        .select("id,attempt_number,status,score,total_points,started_at,submitted_at,is_expired")
        .eq("quiz_id", assessmentId)
        .eq("student_id", identity.id)
        .order("attempt_number", { ascending: false }),
    ),
  ]);
  const options = questions.length
    ? await readAssessment(
        "assessment question options",
        client
          .from("question_options")
          .select("id,question_id,option_text,position")
          .in("question_id", questions.map((question) => question.id))
          .order("position", { ascending: true }),
      )
    : [];
  const optionsByQuestion = new Map();
  for (const option of options) {
    const questionOptions = optionsByQuestion.get(option.question_id) || [];
    questionOptions.push(option);
    optionsByQuestion.set(option.question_id, questionOptions);
  }

  return {
    ...assessment,
    course: Array.isArray(assessment.courses)
      ? assessment.courses[0]
      : assessment.courses,
    questions: questions.map((question) => ({
      ...question,
      options: optionsByQuestion.get(question.id) || [],
    })),
    attempts,
  };
}

export async function getStudentAssessmentHistory() {
  const { identity, client } = await createAssessmentContext();
  const attempts = await readAssessment(
    "your assessment history",
    client
      .from("quiz_attempts")
      .select(
        "id,quiz_id,attempt_number,status,score,total_points,started_at,submitted_at,is_expired,quizzes(title,assessment_type,passing_score,courses(title))",
      )
      .eq("student_id", identity.id)
      .order("created_at", { ascending: false }),
  );

  return attempts.map((attempt) => {
    const assessment = Array.isArray(attempt.quizzes)
      ? attempt.quizzes[0]
      : attempt.quizzes;
    return {
      ...attempt,
      assessment: assessment
        ? {
            ...assessment,
            courses: Array.isArray(assessment.courses)
              ? assessment.courses[0]
              : assessment.courses,
          }
        : null,
    };
  });
}

export async function getStudentQuizAttempt(attemptId) {
  if (!UUID_PATTERN.test(attemptId || "")) notFound();
  const { client } = await createAssessmentContext();
  const result = await readAssessment(
    "the assessment attempt",
    client.rpc("get_student_quiz_attempt", {
      target_attempt_id: attemptId,
    }),
  );
  if (!result) notFound();
  return result;
}

export function isAssessmentId(value) {
  return UUID_PATTERN.test(value || "");
}
