import AiTutorWorkspace from "@/components/student/ai-tutor-workspace";
import { getAiTutorPageData } from "@/lib/ai-tutor/data";

export const metadata = {
  title: "AI language tutor",
  robots: { index: false, follow: false },
};

export default async function StudentAiTutorPage({ searchParams }) {
  const params = await searchParams;
  const data = await getAiTutorPageData(params?.conversation);

  return (
    <div className="student-page ai-tutor-page">
      <AiTutorWorkspace {...data} />
    </div>
  );
}
