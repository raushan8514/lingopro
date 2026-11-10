"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { startStudentAssessment } from "@/app/student/assessments/actions";

export function StartAssessmentButton({
  assessmentId,
  availableFrom,
  availableUntil,
  maximumAttempts,
  attempts,
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const activeAttempt = attempts.find((attempt) => attempt.status === "IN_PROGRESS");
  const attemptsRemaining =
    maximumAttempts === null ? null : maximumAttempts - attempts.length;
  const disabled =
    pending ||
    Boolean(activeAttempt) ||
    (attemptsRemaining !== null && attemptsRemaining <= 0);

  async function startAttempt() {
    setError("");
    if (availableFrom && Date.now() < new Date(availableFrom).getTime()) {
      setError("This assessment is not available yet.");
      return;
    }
    if (availableUntil && Date.now() >= new Date(availableUntil).getTime()) {
      setError("The assessment availability window has ended.");
      return;
    }

    setPending(true);
    try {
      const result = await startStudentAssessment(assessmentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(
        `/student/assessments/${assessmentId}/attempt?attemptId=${result.attemptId}`,
      );
    } catch {
      setError("The assessment could not be started. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="assessment-start-wrap">
      <button
        className="ui-button ui-button-primary ui-button-md"
        disabled={disabled}
        onClick={startAttempt}
        type="button"
      >
        {pending ? (
          <>
            <LoaderCircle className="assessment-spin" size={16} aria-hidden="true" />
            Starting…
          </>
        ) : activeAttempt ? (
          "Attempt in progress"
        ) : attemptsRemaining !== null && attemptsRemaining <= 0 ? (
          "Attempts complete"
        ) : (
          <>
            Start assessment <ArrowRight size={16} aria-hidden="true" />
          </>
        )}
      </button>
      {error && (
        <p className="assessment-inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
