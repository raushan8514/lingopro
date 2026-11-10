import { connection } from "next/server";
import { LessonLearningWorkspace } from "@/components/student/learning-components";
import { getLearningCourse } from "@/lib/student/learning";

export const metadata = {
  title: "Lesson",
  robots: { index: false, follow: false },
};

export default async function LearningLessonPage({ params }) {
  await connection();
  const { courseId, lessonId } = await params;
  const data = await getLearningCourse(courseId, lessonId);

  return <LessonLearningWorkspace data={data} />;
}
