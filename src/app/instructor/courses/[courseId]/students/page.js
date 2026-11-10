import Link from "next/link";
import { ArrowLeft, UsersRound } from "lucide-react";
import { Progress } from "@/components/ui/indicators";
import {
  formatInstructorDateTime,
  InstructorEmptyState,
  InstructorPageHeader,
  InstructorPanel,
  InstructorStatus,
} from "@/components/instructor/instructor-components";
import { getInstructorCourse } from "@/lib/instructor/data";

export const metadata = {
  title: "Course learners",
  robots: { index: false, follow: false },
};

export default async function InstructorStudentsPage({ params }) {
  const { courseId } = await params;
  const { course, students, sections } = await getInstructorCourse(courseId, {
    includeAnswerKeys: false,
    includeCategories: false,
    includeResponses: false,
  });
  const totalLessons = sections.reduce(
    (count, section) => count + section.lessons.filter((lesson) => lesson.is_published).length,
    0,
  );

  return (
    <div className="student-page instructor-page">
      <Link className="instructor-back-link" href={`/instructor/courses/${courseId}`}><ArrowLeft size={15} /> Back to course</Link>
      <InstructorPageHeader
        eyebrow={course.title}
        title="Enrolled learners"
        description="Course-scoped roster, lesson completion, and assessment participation."
      />
      <InstructorPanel eyebrow="Authorized course roster" title={`${students.length} learner${students.length === 1 ? "" : "s"}`}>
        {students.length ? (
          <div className="instructor-table-wrap">
            <table className="instructor-table instructor-student-table">
              <thead>
                <tr><th>Learner</th><th>Enrollment</th><th>Lesson progress</th><th>Assessments</th><th>Last activity</th></tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const completion = totalLessons ? Math.round((student.completedLessons / totalLessons) * 100) : 0;
                  return (
                    <tr key={student.student_id}>
                      <td><strong>{student.full_name || "Learner"}</strong><small>Joined {formatInstructorDateTime(student.enrolled_at)}</small></td>
                      <td><InstructorStatus status={student.enrollment_status} /></td>
                      <td>
                        <Progress
                          className="instructor-student-progress"
                          value={completion}
                          label={`${student.completedLessons} of ${totalLessons} lessons`}
                          showValue
                        />
                      </td>
                      <td>{student.attempts.length} attempt{student.attempts.length === 1 ? "" : "s"}</td>
                      <td>{formatInstructorDateTime(student.lastActivity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <InstructorEmptyState
            title="No enrolled learners"
            description="Students are added when they have an active or completed enrollment in this course."
            icon={UsersRound}
          />
        )}
      </InstructorPanel>
    </div>
  );
}
