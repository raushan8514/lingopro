import { InstructorCourseForm } from "@/components/instructor/instructor-forms";
import {
  InstructorPageHeader,
  InstructorPanel,
} from "@/components/instructor/instructor-components";
import { getInstructorCourses } from "@/lib/instructor/data";

export const metadata = {
  title: "Create a course",
  robots: { index: false, follow: false },
};

export default async function NewInstructorCoursePage() {
  const { categories } = await getInstructorCourses();
  return (
    <div className="student-page instructor-page">
      <InstructorPageHeader
        eyebrow="Course portfolio"
        title="Create a course"
        description="Start with the course essentials. You can add sections and lessons before submitting it for review."
      />
      <InstructorPanel title="Course details" eyebrow="New draft">
        <InstructorCourseForm categories={categories} />
      </InstructorPanel>
    </div>
  );
}
