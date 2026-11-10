import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { AssessmentHistory } from "@/components/student/assessment-components";
import { getStudentAssessmentHistory } from "@/lib/student/assessments";

export const metadata = {
  title: "Assessment history",
  robots: { index: false, follow: false },
};

export default async function StudentAssessmentHistoryPage() {
  await connection();
  const attempts = await getStudentAssessmentHistory();

  return (
    <div className="student-page assessments-page">
      <header className="assessment-page-header">
        <div>
          <p className="student-eyebrow">Your learning record</p>
          <h1>Attempt history</h1>
          <p>Review submitted assessments and resume any work in progress.</p>
        </div>
        <Link className="ui-button ui-button-outline ui-button-md" href="/student/assessments">
          <ArrowLeft size={16} aria-hidden="true" /> Assessments
        </Link>
      </header>
      <AssessmentHistory attempts={attempts} />
    </div>
  );
}
