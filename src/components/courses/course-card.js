import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CourseThumbnail from "@/components/courses/course-thumbnail";

const difficultyLabels = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

function formatPrice(cents, currency) {
  if (cents === 0) return "Free";

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDuration(minutes) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!hours) return `${remainingMinutes} min`;
  if (!remainingMinutes) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

export default function CourseCard({ course }) {
  const duration = formatDuration(course.estimated_duration_minutes);
  const instructor = course.instructor_name || "LingoPro instructor";

  return (
    <article className="market-course-card">
      <Link
        className="market-course-card-main"
        href={`/courses/${encodeURIComponent(course.slug)}`}
        aria-label={`View course: ${course.title}`}
      >
        <div className="market-course-image">
          <CourseThumbnail src={course.thumbnail_url} />
          <span className="market-course-image-shade" aria-hidden="true" />
          {course.category_name && (
            <span className="market-course-category">{course.category_name}</span>
          )}
        </div>
        <div className="market-course-card-content">
          <div className="market-course-card-labels">
            <Badge variant="neutral">{course.language}</Badge>
            <Badge variant="information">
              {difficultyLabels[course.difficulty] || "Course"}
            </Badge>
          </div>
          <h3>{course.title}</h3>
          {course.short_description && <p>{course.short_description}</p>}
        </div>
      </Link>
      <div className="market-course-card-footer">
        <Link
          href={`/instructors/${encodeURIComponent(course.instructor_id)}`}
          className="market-course-instructor"
        >
          <span className="market-course-instructor-avatar" aria-hidden="true">
            {instructor.slice(0, 1).toUpperCase()}
          </span>
          <span>{instructor}</span>
        </Link>
        <div className="market-course-meta">
          {duration && (
            <span>
              <Clock3 size={14} aria-hidden="true" />
              {duration}
            </span>
          )}
          <strong>{formatPrice(course.price_cents, course.currency)}</strong>
          <ArrowUpRight size={15} aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}
