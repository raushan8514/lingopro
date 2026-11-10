import Link from "next/link";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  AdminSearchForm,
  AdminStatus,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminCourses } from "@/lib/admin/data";

export const metadata = { title: "Course moderation", robots: { index: false, follow: false } };

export default async function AdminCoursesPage({ searchParams }) {
  const params = await searchParams;
  const data = await getAdminCourses(params);
  return (
    <div className="student-page admin-page">
      <AdminPageHeader eyebrow="Catalog" title="Course management" description="Search courses by title or instructor, review their status, and inspect curriculum before taking a moderation action." />
      <AdminPanel>
        <AdminSearchForm
          search={data.search}
          action="/admin/courses"
          filters={[
            {
              name: "status",
              label: "Status",
              value: data.status,
              options: ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED"].map((status) => ({ value: status, label: status.replaceAll("_", " ") })),
            },
            {
              name: "category",
              label: "Category",
              value: data.category,
              options: data.categories.map((category) => ({ value: category.id, label: category.name })),
            },
            {
              name: "difficulty",
              label: "Difficulty",
              value: data.difficulty,
              options: ["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((difficulty) => ({ value: difficulty, label: difficulty.toLowerCase() })),
            },
            {
              name: "language",
              label: "Language",
              value: data.language,
              options: data.languages.map((language) => ({ value: language, label: language })),
            },
          ]}
        />
        {data.courses.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Course</th><th>Instructor</th><th>Category</th><th>Language</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>
                {data.courses.map((course) => (
                  <tr key={course.id}>
                    <td><Link href={`/admin/courses/${course.id}`}>{course.title}</Link><small>/{course.slug}</small></td>
                    <td><Link href={`/admin/instructors/${course.instructor_id}`}>{course.instructor_name}</Link></td>
                    <td>{course.category_name || "Uncategorized"}</td>
                    <td>{course.language} · {course.difficulty.toLowerCase()}</td>
                    <td><AdminStatus value={course.status} /></td>
                    <td>{formatAdminDate(course.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <AdminEmptyState title="No courses match" description="Try a different title, instructor, status, or category filter." />}
        <AdminPagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          searchParams={{ q: data.search, status: data.status, category: data.category, difficulty: data.difficulty, language: data.language }}
        />
      </AdminPanel>
    </div>
  );
}
