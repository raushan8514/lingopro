"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Flag, LoaderCircle } from "lucide-react";
import {
  saveStudentAssessmentAnswer,
  submitStudentAssessment,
} from "@/app/student/assessments/actions";

function parseMatchingAnswer(text) {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function makeAnswerMap(questions) {
  return Object.fromEntries(
    questions.map((question) => [
      question.id,
      {
        selectedOptionIds: question.selected_option_ids || [],
        text: question.answer_text || "",
        matching:
          question.question_type === "MATCHING"
            ? parseMatchingAnswer(question.answer_text)
            : {},
        isFlagged: question.is_flagged || false,
      },
    ]),
  );
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export default function AssessmentAttempt({ attempt, initialRemaining }) {
  const router = useRouter();
  const questions = attempt.questions;
  const [answers, setAnswers] = useState(() => makeAnswerMap(questions));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef(new Map());
  const saveChains = useRef(new Map());
  const answerMapRef = useRef(makeAnswerMap(questions));
  const serverOffset = useRef(0);
  const submittedByTimeout = useRef(false);
  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id];
  const answeredCount = Object.values(answers).filter(
    (answer) => answer.selectedOptionIds.length || answer.text.trim(),
  ).length;

  const persistAnswer = useCallback(
    (questionId, answer) => {
      setPendingSaves((count) => count + 1);
      setSaveError("");
      const previous = saveChains.current.get(questionId) || Promise.resolve();
      const next = previous
        .catch(() => undefined)
        .then(() =>
          saveStudentAssessmentAnswer(attempt.id, {
            questionId,
            selectedOptionIds: answer.selectedOptionIds,
            text: answer.text || null,
            isFlagged: answer.isFlagged,
          }),
        )
        .then((result) => {
          if (result.error) setSaveError(result.error);
          return result;
        })
        .catch(() => {
          const result = { error: "Your answer could not be saved." };
          setSaveError(result.error);
          return result;
        })
        .finally(() => {
          setPendingSaves((count) => Math.max(0, count - 1));
        });
      saveChains.current.set(questionId, next);
      return next;
    },
    [attempt.id],
  );

  const scheduleSave = useCallback(
    (questionId, answer) => {
      const existingTimer = timers.current.get(questionId);
      if (existingTimer) clearTimeout(existingTimer);
      timers.current.set(
        questionId,
        setTimeout(() => {
          timers.current.delete(questionId);
          persistAnswer(questionId, answer);
        }, 400),
      );
    },
    [persistAnswer],
  );

  const updateAnswer = useCallback(
    (questionId, update) => {
      const current = answerMapRef.current[questionId];
      const next = {
        ...answerMapRef.current,
        [questionId]: { ...current, ...update },
      };
      answerMapRef.current = next;
      setAnswers(next);
      scheduleSave(questionId, next[questionId]);
    },
    [scheduleSave],
  );

  const submitAttempt = useCallback(
    async (automatic = false) => {
      if (submitting) return;
      if (!automatic && !window.confirm("Submit this assessment now? You cannot change your answers afterward.")) {
        return;
      }

      setSubmitting(true);
      setSubmitError("");
      for (const timeout of timers.current.values()) clearTimeout(timeout);
      timers.current.clear();

      const saveResults = await Promise.all(
        questions.map((question) =>
          persistAnswer(question.id, answerMapRef.current[question.id]),
        ),
      );
      if (
        !automatic &&
        (!attempt.expires_at || remaining > 0) &&
        saveResults.some((saveResult) => saveResult.error)
      ) {
        setSubmitError(
          "Some answers could not be saved. Check your connection and submit again.",
        );
        setSubmitting(false);
        return;
      }

      let result;
      try {
        result = await submitStudentAssessment(attempt.id);
      } catch {
        setSubmitError("The assessment could not be submitted. Please try again.");
        setSubmitting(false);
        return;
      }
      if (result.error) {
        setSubmitError(result.error);
        setSubmitting(false);
        return;
      }
      router.replace(
        `/student/assessments/${attempt.quiz_id}/result/${attempt.id}`,
      );
    },
    [
      attempt.expires_at,
      attempt.id,
      attempt.quiz_id,
      persistAnswer,
      questions,
      remaining,
      router,
      submitting,
    ],
  );

  const submitRef = useRef(submitAttempt);
  useEffect(() => {
    submitRef.current = submitAttempt;
  }, [submitAttempt]);

  useEffect(() => {
    if (!attempt.expires_at) return undefined;
    serverOffset.current =
      new Date(attempt.server_time).getTime() - Date.now();
    const updateTime = () => {
      const secondsLeft = Math.max(
        0,
        Math.ceil(
          (new Date(attempt.expires_at).getTime() -
            (Date.now() + serverOffset.current)) /
            1000,
        ),
      );
      setRemaining(secondsLeft);
      if (secondsLeft === 0 && !submittedByTimeout.current) {
        submittedByTimeout.current = true;
        submitRef.current(true);
      }
    };
    updateTime();
    const intervalId = setInterval(updateTime, 1000);
    return () => clearInterval(intervalId);
  }, [attempt.expires_at, attempt.server_time]);

  useEffect(
    () => () => {
      for (const timeout of timers.current.values()) clearTimeout(timeout);
    },
    [],
  );

  function toggleOption(optionId) {
    const selected = currentAnswer.selectedOptionIds;
    const multiple = currentQuestion.question_type === "MULTIPLE_SELECT";
    const nextOptions = multiple
      ? selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId]
      : selected.includes(optionId)
        ? []
        : [optionId];
    updateAnswer(currentQuestion.id, { selectedOptionIds: nextOptions });
  }

  return (
    <section className="assessment-attempt-panel" aria-label="Assessment attempt">
      <header className="assessment-attempt-header">
        <div>
          <p className="student-eyebrow">
            {attempt.assessment_type === "EXAM" ? "Examination" : "Practice"} ·{" "}
            {answeredCount} of {questions.length} answered
          </p>
          <h1>{attempt.title}</h1>
        </div>
        {attempt.expires_at && (
          <div
            className={`assessment-countdown${remaining <= 60 ? " is-urgent" : ""}`}
            aria-live="polite"
            aria-label={`Time remaining ${formatTime(remaining)}`}
          >
            <span>Time remaining</span>
            <strong>{formatTime(remaining)}</strong>
          </div>
        )}
      </header>

      <div className="assessment-attempt-progress" aria-label="Question progress">
        {questions.map((question, index) => {
          const answer = answers[question.id];
          const isAnswered =
            answer.selectedOptionIds.length > 0 || answer.text.trim().length > 0;
          return (
            <button
              aria-current={index === currentIndex ? "step" : undefined}
              aria-label={`Question ${index + 1}${isAnswered ? ", answered" : ", unanswered"}${answer.isFlagged ? ", flagged" : ""}`}
              className={[
                "assessment-question-marker",
                index === currentIndex ? "is-current" : "",
                isAnswered ? "is-answered" : "",
                answer.isFlagged ? "is-flagged" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={question.id}
              disabled={submitting}
              onClick={() => setCurrentIndex(index)}
              type="button"
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <article className="assessment-question-panel">
        <div className="assessment-question-heading">
          <p className="student-eyebrow">
            Question {currentIndex + 1} of {questions.length} · {currentQuestion.points}{" "}
            {Number(currentQuestion.points) === 1 ? "point" : "points"}
          </p>
          <button
            aria-pressed={currentAnswer.isFlagged}
            className={`assessment-flag-button${currentAnswer.isFlagged ? " is-flagged" : ""}`}
            disabled={submitting}
            onClick={() =>
              updateAnswer(currentQuestion.id, {
                isFlagged: !currentAnswer.isFlagged,
              })
            }
            type="button"
          >
            <Flag size={16} aria-hidden="true" />
            {currentAnswer.isFlagged ? "Flagged" : "Flag for review"}
          </button>
        </div>
        <h2>{currentQuestion.question_text}</h2>
        {currentQuestion.difficulty && (
          <p className="assessment-question-difficulty">
            Difficulty: {currentQuestion.difficulty.toLowerCase()}
          </p>
        )}
        {currentQuestion.resource_links?.length > 0 && (
          <ul className="assessment-question-resources" aria-label="Question resources">
            {currentQuestion.resource_links.map((resource) => (
              <li key={`${resource.label}-${resource.url}`}>
                <a href={resource.url} rel="noreferrer" target="_blank">
                  {resource.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        {currentQuestion.question_type === "MATCHING" ? (
          <fieldset className="assessment-options assessment-matching-options">
            <legend className="student-sr-only">
              Choose a matching answer for each prompt
            </legend>
            {currentQuestion.options.map((option) => (
              <label className="assessment-matching-row" key={option.id}>
                <span>{option.option_text}</span>
                <select
                  aria-label={`Match for ${option.option_text}`}
                  disabled={submitting}
                  onChange={(event) => {
                    const matching = { ...currentAnswer.matching };
                    if (event.target.value) {
                      matching[option.id] = event.target.value;
                    } else {
                      delete matching[option.id];
                    }
                    updateAnswer(currentQuestion.id, {
                      matching,
                      text: Object.keys(matching).length
                        ? JSON.stringify(matching)
                        : "",
                    });
                  }}
                  value={currentAnswer.matching[option.id] || ""}
                >
                  <option value="">Select a match</option>
                  {currentQuestion.matching_choices.map((choice) => (
                    <option
                      disabled={
                        Object.entries(currentAnswer.matching).some(
                          ([promptId, answer]) =>
                            promptId !== option.id && answer === choice.value,
                        )
                      }
                      key={choice.value}
                      value={choice.value}
                    >
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
        ) : currentQuestion.options.length > 0 ? (
          <fieldset className="assessment-options">
            <legend className="student-sr-only">
              {currentQuestion.question_type === "MULTIPLE_SELECT"
                ? "Choose all correct answers"
                : "Choose one answer"}
            </legend>
            {currentQuestion.options.map((option) => {
              const checked = currentAnswer.selectedOptionIds.includes(option.id);
              const multiple =
                currentQuestion.question_type === "MULTIPLE_SELECT";
              return (
                <label
                  className={`assessment-option${checked ? " is-selected" : ""}`}
                  key={option.id}
                >
                  <input
                    checked={checked}
                    disabled={submitting}
                    name={`question-${currentQuestion.id}`}
                    onChange={() => toggleOption(option.id)}
                    type={multiple ? "checkbox" : "radio"}
                  />
                  <span className="assessment-option-control" aria-hidden="true">
                    {checked && <Check size={14} />}
                  </span>
                  <span>{option.option_text}</span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <label className="assessment-answer-field">
            <span>
              {currentQuestion.question_type === "SHORT_ANSWER"
                ? "Your response (reviewed by your instructor)"
                : currentQuestion.question_type === "LONG_ANSWER"
                  ? "Your long-form response (reviewed by your instructor)"
                : "Your answer"}
            </span>
            <textarea
              maxLength={10000}
              disabled={submitting}
              onChange={(event) =>
                updateAnswer(currentQuestion.id, { text: event.target.value })
              }
              placeholder="Type your response…"
              rows={
                currentQuestion.question_type === "LONG_ANSWER"
                  ? 12
                  : currentQuestion.question_type === "SHORT_ANSWER"
                    ? 6
                    : 3
              }
              value={currentAnswer.text}
            />
          </label>
        )}

        <footer className="assessment-question-footer">
          <button
            className="ui-button ui-button-outline ui-button-md"
            disabled={submitting || currentIndex === 0}
            onClick={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
            type="button"
          >
            <ChevronLeft size={16} aria-hidden="true" /> Previous
          </button>
          <span className="assessment-save-status" aria-live="polite">
            {saveError ? (
              <span className="assessment-inline-error">{saveError}</span>
            ) : pendingSaves ? (
              <>
                <LoaderCircle className="assessment-spin" size={14} aria-hidden="true" />
                Saving…
              </>
            ) : (
              "All changes saved"
            )}
          </span>
          {currentIndex < questions.length - 1 ? (
            <button
              className="ui-button ui-button-primary ui-button-md"
              disabled={submitting}
              onClick={() =>
                setCurrentIndex((index) => Math.min(index + 1, questions.length - 1))
              }
              type="button"
            >
              Next <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              className="ui-button ui-button-primary ui-button-md"
              disabled={submitting}
              onClick={() => submitAttempt(false)}
              type="button"
            >
              {submitting ? "Submitting…" : "Submit assessment"}
            </button>
          )}
        </footer>
        {submitError && (
          <p className="assessment-inline-error" role="alert">
            {submitError}
          </p>
        )}
      </article>
    </section>
  );
}
