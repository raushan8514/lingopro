import { Suspense } from "react";
import CourseCatalog from "@/components/courses/course-catalog";
import CourseLoading from "@/components/courses/course-loading";
import { connection } from "next/server";

export const metadata = {
  title: "Explore language courses",
  description:
    "Search published language courses by language, level, category, and price.",
  alternates: { canonical: "/courses" },
};

export default function CoursesPage({ searchParams }) {
  return (
    <Suspense fallback={<CourseLoading />}>
      <CoursesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CoursesContent({ searchParams }) {
  await connection();
  return <CourseCatalog searchParams={searchParams} />;
}
