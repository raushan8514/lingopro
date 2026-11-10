import "server-only";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logInstructorReadFailure(operation, error) {
  console.error(`Unable to ${operation}.`, {
    code: error?.code,
    status: error?.status,
    name: error?.name,
    message: typeof error?.message === "string" ? error.message.slice(0, 500) : undefined,
  });
}

async function read(operation, query) {
  const { data, error } = await query;
  if (error) {
    logInstructorReadFailure(operation, error);
    throw new Error(`The instructor workspace could not load ${operation}.`);
  }
  return data;
}

async function getInstructorContext() {
  const [identity, client] = await Promise.all([
    requireRole("instructor"),
    createClient({ allowCookieWrites: false }),
  ]);
  return {
    identity: {
      id: identity.user.id,
      email: identity.user.email || "",
      fullName: identity.fullName || "",
    },
    client,
  };
}

function relation(value) {
  return Array.isArray(value) ? value[0] || null : value;
}

async function getCoursesForInstructor(client, instructorId) {
  return read(
    "your courses",
    client
      .from("courses")
      .select(
        "id,instructor_id,category_id,title,slug,short_description,description,learning_outcomes,prerequisites,target_audience,language,difficulty,thumbnail_url,price_cents,currency,estimated_duration_minutes,status,published_at,created_at,updated_at,course_categories(name)",
      )
      .eq("instructor_id", instructorId)
      .order("updated_at", { ascending: false }),
  );
}

export async function getInstructorDashboardData() {
  const { identity, client } = await getInstructorContext();
  const courses = await getCoursesForInstructor(client, identity.id);
  const courseIds = courses.map((course) => course.id);

  if (!courseIds.length) {
    return {
      identity,
      courses: [],
      totalStudents: 0,
      totalLessons: 0,
      completedLessons: 0,
      assessmentParticipation: 0,
      averageAssessmentScore: null,
      recentEnrollments: [],
      recentActivity: [],
    };
  }

  const [enrollments, sections, quizzes] = await Promise.all([
    read(
      "course enrollments",
      client
        .from("enrollments")
        .select("id,course_id,student_id,status,enrolled_at")
        .in("course_id", courseIds)
        .in("status", ["ACTIVE", "COMPLETED"])
        .order("enrolled_at", { ascending: false })
        .limit(1000),
    ),
    read(
      "course curriculum",
      client
        .from("course_sections")
        .select("id,course_id,lessons(id,title,is_published)")
        .in("course_id", courseIds),
    ),
    read(
      "course assessments",
      client
        .from("quizzes")
        .select("id,course_id,title,is_published")
        .in("course_id", courseIds),
    ),
  ]);
  const publishedLessonIds = sections.flatMap((section) =>
    (section.lessons || [])
      .filter((lesson) => lesson.is_published)
      .map((lesson) => lesson.id),
  );
  const quizIds = quizzes.map((quiz) => quiz.id);

  const [progress, attempts] = await Promise.all([
    publishedLessonIds.length
      ? read(
          "lesson completion records",
          client
            .from("lesson_progress")
            .select("lesson_id,status,last_accessed_at,completed_at,student_id")
            .in("lesson_id", publishedLessonIds)
            .order("last_accessed_at", { ascending: false })
            .limit(1000),
        )
      : [],
    quizIds.length
      ? read(
          "assessment attempts",
          client
            .from("quiz_attempts")
            .select("id,quiz_id,student_id,status,score,total_points,started_at,submitted_at")
            .in("quiz_id", quizIds)
            .order("created_at", { ascending: false })
            .limit(1000),
        )
      : [],
  ]);

  const uniqueStudentIds = new Set(
    enrollments.map((enrollment) => enrollment.student_id),
  );
  const gradedAttempts = attempts.filter(
    (attempt) => attempt.status === "GRADED" && Number(attempt.total_points) > 0,
  );
  const recentEnrollments = enrollments.slice(0, 6);
  const rosters = await Promise.all(
    [...new Set(recentEnrollments.map((enrollment) => enrollment.course_id))].map(
      async (courseId) => {
        const roster = await read(
          "authorized student names",
          client.rpc("get_course_student_roster", {
            target_course_id: courseId,
          }),
        );
        return [courseId, new Map(roster.map((student) => [student.student_id, student.full_name]))];
      },
    ),
  );
  const namesByCourse = new Map(rosters);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
  const lessonTitles = new Map(
    sections.flatMap((section) =>
      (section.lessons || []).map((lesson) => [lesson.id, lesson.title]),
    ),
  );

  return {
    identity,
    courses: courses.map((course) => ({
      ...course,
      category: relation(course.course_categories),
      sectionCount: sections.filter((section) => section.course_id === course.id).length,
      lessonCount: sections
        .filter((section) => section.course_id === course.id)
        .reduce(
          (count, section) =>
            count + (section.lessons || []).filter((lesson) => lesson.is_published).length,
          0,
        ),
      studentCount: new Set(
        enrollments
          .filter((enrollment) => enrollment.course_id === course.id)
          .map((enrollment) => enrollment.student_id),
      ).size,
    })),
    totalStudents: uniqueStudentIds.size,
    totalLessons: sections.reduce(
      (count, section) =>
        count + (section.lessons || []).filter((lesson) => lesson.is_published).length,
      0,
    ),
    completedLessons: progress.filter((item) => item.status === "COMPLETED").length,
    assessmentParticipation: attempts.filter((attempt) => attempt.submitted_at).length,
    averageAssessmentScore: gradedAttempts.length
      ? Math.round(
          gradedAttempts.reduce(
            (total, attempt) =>
              total +
              (Number(attempt.score) / Number(attempt.total_points)) * 100,
            0,
          ) / gradedAttempts.length,
        )
      : null,
    recentEnrollments: recentEnrollments.map((enrollment) => ({
      ...enrollment,
      studentName:
        namesByCourse.get(enrollment.course_id)?.get(enrollment.student_id) ||
        "Learner",
      courseTitle: courseTitles.get(enrollment.course_id) || "Course",
    })),
    recentActivity: progress.slice(0, 8).map((item) => ({
      ...item,
      lessonTitle: lessonTitles.get(item.lesson_id) || "Lesson",
      courseTitle:
        courses.find((course) =>
          sections.some(
            (section) =>
              section.course_id === course.id &&
              (section.lessons || []).some((lesson) => lesson.id === item.lesson_id),
          ),
        )?.title || "Course",
    })),
  };
}

export async function getInstructorCourses(filters = {}) {
  const { identity, client } = await getInstructorContext();
  let courses = (await getCoursesForInstructor(client, identity.id)).map((course) => ({
    ...course,
    category: relation(course.course_categories),
  }));
  const query = String(filters.query || "").trim().toLowerCase();
  const status = filters.status || "ALL";
  if (query) {
    courses = courses.filter(
      (course) =>
        course.title.toLowerCase().includes(query) ||
        course.language.toLowerCase().includes(query) ||
        course.slug.includes(query),
    );
  }
  if (status !== "ALL") courses = courses.filter((course) => course.status === status);

  const categories = await read(
    "course categories",
    client
      .from("course_categories")
      .select("id,name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  );
  return { identity, courses, categories };
}

export async function getInstructorAssessments() {
  const { identity, client } = await getInstructorContext();
  const courses = await getCoursesForInstructor(client, identity.id);
  if (!courses.length) return { identity, assessments: [] };

  const quizzes = await read(
    "your assessments",
    client
      .from("quizzes")
      .select(
        "id,course_id,title,description,assessment_type,is_published,available_from,available_until,created_at",
      )
      .in("course_id", courses.map((course) => course.id))
      .order("created_at", { ascending: false }),
  );
  const questions = quizzes.length
    ? await read(
        "assessment questions",
        client
          .from("quiz_questions")
          .select("id,quiz_id")
          .in("quiz_id", quizzes.map((quiz) => quiz.id)),
      )
    : [];
  const questionCounts = new Map();
  for (const question of questions) {
    questionCounts.set(
      question.quiz_id,
      (questionCounts.get(question.quiz_id) || 0) + 1,
    );
  }
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return {
    identity,
    assessments: quizzes.map((quiz) => ({
      ...quiz,
      questionCount: questionCounts.get(quiz.id) || 0,
      courseTitle: courseTitles.get(quiz.course_id) || "Course",
    })),
  };
}

export async function getInstructorAssessment(assessmentId) {
  if (!UUID_PATTERN.test(assessmentId || "")) notFound();
  const { identity, client } = await getInstructorContext();
  const courses = await getCoursesForInstructor(client, identity.id);
  if (!courses.length) notFound();

  const matches = await read(
    "the selected assessment",
    client
      .from("quizzes")
      .select("id,course_id")
      .eq("id", assessmentId)
      .in("course_id", courses.map((course) => course.id))
      .maybeSingle(),
  );
  if (!matches) notFound();

  const data = await getInstructorCourse(matches.course_id, {
    assessmentId,
    includeCategories: false,
    includeProgress: false,
    includeResponses: true,
    includeQuestionBank: true,
  });
  const assessment = data.assessments.find((item) => item.id === assessmentId);
  if (!assessment) notFound();
  return { ...data, assessment };
}

export async function getInstructorCourse(courseId, options = {}) {
  if (!UUID_PATTERN.test(courseId || "")) notFound();
  const {
    assessmentId = null,
    includeAssessments = true,
    includeAnswerKeys = true,
    includeAttempts = true,
    includeCategories = true,
    includeProgress = true,
    includeResponses = true,
    includeRoster = true,
    includeQuestionBank = false,
  } = options;
  const { identity, client } = await getInstructorContext();
  const course = await read(
    "the selected course",
    client
      .from("courses")
      .select(
        "id,instructor_id,category_id,title,slug,short_description,description,learning_outcomes,prerequisites,target_audience,language,difficulty,thumbnail_url,price_cents,currency,estimated_duration_minutes,status,published_at,created_at,updated_at",
      )
      .eq("id", courseId)
      .eq("instructor_id", identity.id)
      .maybeSingle(),
  );
  if (!course) notFound();

  const quizQuery = client
    .from("quizzes")
    .select(
      "id,course_id,lesson_id,section_id,assessment_scope,is_required,required_for_certificate,title,description,instructions,assessment_type,time_limit_seconds,passing_score,maximum_attempts,is_published,available_from,available_until,randomize_questions,randomize_options,allow_partial_credit,negative_marking,allow_result_review,show_correct_answers,show_explanations,allow_concurrent_attempts,created_at",
    )
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (assessmentId) quizQuery.eq("id", assessmentId);

  const [categories, sections, quizzes, roster, certificateRequirements, questionBankItems] = await Promise.all([
    includeCategories
      ? read(
          "course categories",
          client
            .from("course_categories")
            .select("id,name")
            .eq("is_active", true)
            .order("name", { ascending: true }),
        )
      : [],
    read(
      "course sections",
      client
        .from("course_sections")
        .select("id,course_id,title,description,position,created_at,lessons(id,section_id,title,description,content_type,content,video_url,audio_url,video_storage_path,audio_storage_path,duration_seconds,position,is_preview,is_published,lesson_resources(id,title,resource_type,storage_path,storage_bucket,external_url,file_size_bytes))")
        .eq("course_id", courseId)
        .order("position", { ascending: true }),
    ),
    includeAssessments
      ? read("course assessments", quizQuery)
      : [],
    includeRoster
      ? read(
          "enrolled course students",
          client.rpc("get_course_student_roster", {
            target_course_id: courseId,
          }),
        )
      : [],
    read(
      "certificate requirements",
      client
        .from("course_certificate_requirements")
        .select(
          "required_lesson_completion_percent,require_required_assessments,require_final_exam,minimum_final_exam_score",
        )
        .eq("course_id", courseId)
        .maybeSingle(),
    ),
    includeQuestionBank
      ? read(
          "the course question bank",
          client
            .from("question_bank_items")
            .select("id,source_question_id,question_text,question_type,difficulty,resource_links,points,created_at")
            .eq("course_id", courseId)
            .order("created_at", { ascending: false }),
        )
      : [],
  ]);
  const quizIds = quizzes.map((quiz) => quiz.id);
  const questionRows =
    includeAssessments && quizIds.length
      ? await read(
          "assessment questions",
          client
            .from("quiz_questions")
            .select(
              includeAnswerKeys || includeResponses
                ? "id,quiz_id,question_text,question_type,points,position,difficulty,resource_links"
                : "id,quiz_id",
            )
            .in("quiz_id", quizIds)
            .order("position", { ascending: true }),
        )
      : [];
  const questionIds = questionRows.map((question) => question.id);
  const questionOptions =
    (includeAnswerKeys || includeResponses) && questionIds.length
      ? await read(
          "assessment question options",
          client
            .from("question_options")
            .select("id,question_id,option_text,position")
            .in("question_id", questionIds)
            .order("position", { ascending: true }),
        )
      : [];
  const optionsByQuestion = new Map();
  for (const option of questionOptions) {
    const options = optionsByQuestion.get(option.question_id) || [];
    options.push(option);
    optionsByQuestion.set(option.question_id, options);
  }
  const questionsByQuiz = new Map();
  const questionsById = new Map();
  for (const question of questionRows) {
    const enrichedQuestion = {
      ...question,
      question_options: optionsByQuestion.get(question.id) || [],
    };
    const questions = questionsByQuiz.get(question.quiz_id) || [];
    questions.push(enrichedQuestion);
    questionsByQuiz.set(question.quiz_id, questions);
    questionsById.set(question.id, enrichedQuestion);
  }
  const bankedQuestionIds = new Set(
    questionBankItems.map((item) => item.source_question_id).filter(Boolean),
  );

  const assessmentKeys = includeAnswerKeys
    ? await Promise.all(
        quizzes.map(async (quiz) => {
          const keys = await read(
            "assessment answer keys",
            client.rpc("get_quiz_answer_key", { target_quiz_id: quiz.id }),
          );
          return [quiz.id, new Map(keys.map((key) => [key.question_id, key]))];
        }),
      )
    : [];
  const keysByQuiz = new Map(assessmentKeys);

  const publishedLessonIds = sections.flatMap((section) =>
    (section.lessons || [])
      .filter((lesson) => lesson.is_published)
      .map((lesson) => lesson.id),
  );
  const [progress, attempts] = await Promise.all([
    includeProgress && publishedLessonIds.length
      ? read(
          "student course progress",
          client
            .from("lesson_progress")
            .select("student_id,lesson_id,status,last_accessed_at,completed_at")
            .in("lesson_id", publishedLessonIds),
        )
      : [],
    includeAttempts && quizIds.length
      ? read(
          "course assessment results",
          client
            .from("quiz_attempts")
            .select("id,quiz_id,student_id,attempt_number,status,score,total_points,started_at,submitted_at,is_expired")
            .in("quiz_id", quizIds)
            .order("created_at", { ascending: false }),
        )
      : [],
  ]);
  const answers = includeResponses && attempts.length
    ? await read(
        "assessment responses",
        client
          .from("quiz_answers")
          .select(
            "id,attempt_id,question_id,answer_text,selected_option_ids,awarded_points",
          )
          .in("attempt_id", attempts.map((attempt) => attempt.id)),
      )
    : [];
  const gradingModeByQuestion = new Map(
    questionRows.map((question) => [
      question.id,
      keysByQuiz.get(question.quiz_id)?.get(question.id)?.grading_mode || "AUTO",
    ]),
  );
  const answersByAttempt = new Map();
  for (const answer of answers) {
    const questionRecord = questionsById.get(answer.question_id);
    const question = {
      ...questionRecord,
      grading_mode: gradingModeByQuestion.get(answer.question_id) || "AUTO",
    };
    const answerWithQuestion = {
      ...answer,
      question,
      options: (question?.question_options || []).filter((option) =>
        (answer.selected_option_ids || []).includes(option.id),
      ),
    };
    const list = answersByAttempt.get(answer.attempt_id) || [];
    list.push(answerWithQuestion);
    answersByAttempt.set(answer.attempt_id, list);
  }
  const studentsById = new Map(
    roster.map((student) => [student.student_id, student.full_name]),
  );

  return {
    identity,
    course,
    certificateRequirements: certificateRequirements || {
      required_lesson_completion_percent: 100,
      require_required_assessments: true,
      require_final_exam: false,
      minimum_final_exam_score: 70,
    },
    categories,
    sections: sections.map((section) => ({
      ...section,
      lessons: (section.lessons || [])
        .map((lesson) => ({
          ...lesson,
          resources: lesson.lesson_resources || [],
        }))
        .sort((left, right) => left.position - right.position),
    })),
    assessments: quizzes.map((quiz) => ({
      ...quiz,
      questions: (questionsByQuiz.get(quiz.id) || [])
        .map((question) => {
          const key = keysByQuiz.get(quiz.id)?.get(question.id);
          const questionOptions = question.question_options || [];
          return {
            ...question,
            is_in_question_bank: bankedQuestionIds.has(question.id),
            explanation: key?.explanation || "",
            grading_mode: key?.grading_mode || "AUTO",
            accepted_answers: key?.accepted_answers || [],
            correct_option_ids: key?.correct_option_ids || [],
            answer_key: key?.answer_key || "",
            case_sensitive: key?.case_sensitive || false,
            normalize_whitespace: key?.normalize_whitespace ?? true,
            matching_pairs:
              question.question_type === "MATCHING" && key?.answer_key
                ? (JSON.parse(key.answer_key) || []).map((answer, index) => ({
                    prompt: questionOptions[index]?.option_text || "",
                    answer,
                  }))
                : [],
            options: questionOptions
              .map((option) => ({
                ...option,
                is_correct: (key?.correct_option_ids || []).includes(option.id),
              })),
          };
        })
        .sort((left, right) => left.position - right.position),
      attempts: attempts
        .filter((attempt) => attempt.quiz_id === quiz.id)
        .map((attempt) => ({
          ...attempt,
          studentName: studentsById.get(attempt.student_id) || "Learner",
          answers: answersByAttempt.get(attempt.id) || [],
        })),
    })),
    students: roster.map((student) => ({
      ...student,
      completedLessons: progress.filter(
        (item) =>
          item.student_id === student.student_id && item.status === "COMPLETED",
      ).length,
      totalLessons: publishedLessonIds.length,
      attempts: attempts.filter((attempt) => attempt.student_id === student.student_id),
      lastActivity: progress
        .filter((item) => item.student_id === student.student_id)
        .map((item) => item.last_accessed_at)
        .filter(Boolean)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null,
    })),
    progress,
    attempts,
    questionBankItems,
  };
}

export async function getInstructorProfile() {
  const { identity, client } = await getInstructorContext();
  const profile = await read(
    "your instructor profile",
    client
      .from("profiles")
      .select("id,full_name,email,avatar_url,avatar_path,created_at")
      .eq("id", identity.id)
      .single(),
  );
  return { identity, profile };
}

export function isInstructorResourceId(value) {
  return UUID_PATTERN.test(value || "");
}
