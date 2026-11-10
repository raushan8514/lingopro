import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import AssessmentAttempt from "@/components/student/assessment-attempt";
import { getStudentQuizAttempt, isAssessmentId } from "@/lib/student/assessments";

export const metadata = {
  title: "Assessment attempt",
  robots: { index: false, follow: false },
};

export default async function StudentAssessmentAttemptPage({
  params,
  searchParams,
}) {
  await connection();
  const [{ assessmentId }, query] = await Promise.all([params, searchParams]);
  const attemptId = Array.isArray(query.attemptId)
    ? query.attemptId[0]
    : query.attemptId;
  if (!isAssessmentId(attemptId)) notFound();

  const attempt = await getStudentQuizAttempt(attemptId);
  if (attempt.quiz_id !== assessmentId) notFound();
  if (attempt.status !== "IN_PROGRESS") {
    redirect(`/student/assessments/${assessmentId}/result/${attemptId}`);
  }
  if (!attempt.questions.length) notFound();

  const initialRemaining = attempt.expires_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(attempt.expires_at).getTime() -
            new Date(attempt.server_time).getTime()) /
            1000,
        ),
      )
    : null;

  return (
    <div className="student-page assessments-page">
      <AssessmentAttempt
        attempt={attempt}
        initialRemaining={initialRemaining}
      />
    </div>
  );
}
