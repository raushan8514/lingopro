"use server";

import { revalidatePath } from "next/cache";
import { getStudentIdentity } from "@/lib/student/data";
import { isAssessmentId } from "@/lib/student/assessments";
import { createClient } from "@/lib/supabase/server";

function logAssessmentActionFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
  });
}

function actionError(operation, error) {
  logAssessmentActionFailure(operation, error);
  return {
    error: "Your assessment could not be saved. Check your connection and try again.",
  };
}

export async function startStudentAssessment(assessmentId) {
  await getStudentIdentity();
  if (!isAssessmentId(assessmentId)) {
    return { error: "This assessment link is invalid." };
  }

  const client = await createClient();
  const { data, error } = await client.rpc("start_quiz_attempt", {
    target_quiz_id: assessmentId,
  });
  if (error || !data) return actionError("start an assessment", error || new Error("Missing attempt id."));
  return { attemptId: data };
}

export async function saveStudentAssessmentAnswer(attemptId, answer) {
  await getStudentIdentity();
  if (
    !isAssessmentId(attemptId) ||
    !isAssessmentId(answer?.questionId) ||
    !Array.isArray(answer?.selectedOptionIds) ||
    answer.selectedOptionIds.length > 100 ||
    !answer.selectedOptionIds.every(isAssessmentId) ||
    typeof answer?.isFlagged !== "boolean" ||
    (answer?.text !== null && typeof answer?.text !== "string") ||
    (typeof answer?.text === "string" && answer.text.length > 10000)
  ) {
    return { error: "The answer format is invalid." };
  }

  const client = await createClient();
  const { error } = await client.rpc("save_quiz_answer", {
    target_attempt_id: attemptId,
    target_question_id: answer.questionId,
    target_option_ids: answer.selectedOptionIds,
    target_answer_text: answer.text,
    target_is_flagged: answer.isFlagged,
  });
  if (error) return actionError("save an assessment answer", error);
  return { success: true };
}

export async function submitStudentAssessment(attemptId) {
  await getStudentIdentity();
  if (!isAssessmentId(attemptId)) {
    return { error: "This assessment attempt is invalid." };
  }

  const client = await createClient();
  const { data, error } = await client.rpc("submit_quiz_attempt", {
    target_attempt_id: attemptId,
  });
  if (error || !data?.[0]) {
    return actionError("submit an assessment", error || new Error("Missing submission result."));
  }
  revalidatePath("/student/achievements");
  revalidatePath("/student/courses");
  return {
    result: data[0],
  };
}
