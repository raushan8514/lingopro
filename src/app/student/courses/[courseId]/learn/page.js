import { connection } from "next/server";
import { LearningCourseOverview } from "@/components/student/learning-components";
import { getLearningCourse } from "@/lib/student/learning";

export const metadata = {
  title: "Course learning path",
  robots: { index: false, follow: false },
};

export default async function LearningCoursePage({ params }) {
  await connection();
  const { courseId } = await params;
  const data = await getLearningCourse(courseId);

  return <LearningCourseOverview data={data} />;
}
