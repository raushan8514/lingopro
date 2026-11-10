import { AdminCategoryForm } from "@/components/admin/admin-forms";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminStatus,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminCategories } from "@/lib/admin/data";

export const metadata = { title: "Category management", robots: { index: false, follow: false } };

export default async function AdminCategoriesPage() {
  const categories = await getAdminCategories();
  return (
    <div className="student-page admin-page">
      <AdminPageHeader eyebrow="Catalog organization" title="Course categories" description="Create and maintain categories used to organize public course discovery." />
      <AdminPanel eyebrow="Add catalog category" title="New category">
        <AdminCategoryForm />
      </AdminPanel>
      <AdminPanel eyebrow="Existing catalog taxonomy" title={`${categories.length} categories`}>
        {categories.length ? (
          <div className="admin-category-list">
            {categories.map((category) => (
              <details className="admin-category-item" key={category.id}>
                <summary>
                  <span><strong>{category.name}</strong><small>/{category.slug} · {category.courseCount} course{category.courseCount === 1 ? "" : "s"} · Updated {formatAdminDate(category.updated_at)}</small></span>
                  <AdminStatus value={category.is_active ? "ACTIVE" : "INACTIVE"} />
                </summary>
                {category.courses.length > 0 && (
                  <ul className="admin-category-courses">
                    {category.courses.map((course) => (
                      <li key={course.id}>
                        <Link href={`/admin/courses/${course.id}`}>{course.title}</Link>
                        <AdminStatus value={course.status} />
                      </li>
                    ))}
                    {category.courseCount > category.courses.length && (
                      <li className="admin-muted">Showing 20 of {category.courseCount} assigned courses.</li>
                    )}
                  </ul>
                )}
                <AdminCategoryForm category={category} />
              </details>
            ))}
          </div>
        ) : <AdminEmptyState title="No categories yet" description="Create a category to organize courses in the marketplace." />}
      </AdminPanel>
      <p className="admin-capability-note">Deletion is intentionally unavailable. Deactivate categories that are in use so existing course assignments and records remain intact.</p>
    </div>
  );
}
