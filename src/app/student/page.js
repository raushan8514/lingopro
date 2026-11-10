import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Flame,
  Target,
} from "lucide-react";
import {
  StudentActivityList,
  StudentCourseCard,
  StudentNoCoursesMessage,
  StudentStatCard,
} from "@/components/student/student-components";
import { getStudentDashboardData } from "@/lib/student/data";
import { Progress } from "@/components/ui/indicators";

export const metadata = {
  title: "Learning overview",
  robots: { index: false, follow: false },
};

function localDate(timeZone) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(new Date());
}

export default async function StudentDashboardPage() {
  const data = await getStudentDashboardData();
  const name = data.profile.full_name || "Learner";

  return (
    <div className="student-page">
      <section className="student-welcome-panel">
        <div className="student-welcome-copy">
          <p className="student-eyebrow">{localDate(data.goals.timezone)}</p>
          <h1>Welcome back, {name.split(/\s+/)[0]}</h1>
          <p>
            Every thoughtful practice brings a new language closer. Pick up where
            you left off, or choose a fresh course when you are ready.
          </p>
          <Link className="student-primary-link" href="/courses">
            Explore courses <BookOpen size={16} aria-hidden="true" />
          </Link>
          <Link className="student-inline-link student-assessments-link" href="/student/assessments">
            Practice an assessment <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="student-welcome-avatar">
          <span className="student-welcome-orbit orbit-one" />
          <span className="student-welcome-orbit orbit-two" />
          <span className="student-welcome-avatar-frame">
            {data.profile.avatar_url ? (
              // The private image URL is a short-lived Supabase signed URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.profile.avatar_url} alt="" />
            ) : (
              <span aria-hidden="true">
                {name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </span>
            )}
          </span>
        </div>
      </section>

      <section className="student-stat-grid" aria-label="Learning statistics">
        <StudentStatCard
          Icon={BookOpen}
          label="Enrolled courses"
          value={data.enrolledCourseCount}
          detail="Active and completed"
          tone="green"
        />
        <StudentStatCard
          Icon={CheckCircle2}
          label="Lessons completed"
          value={data.completedLessons}
          detail={data.totalLessons ? `Of ${data.totalLessons} published lessons` : "No published lessons yet"}
          tone="blue"
        />
        <StudentStatCard
          Icon={Activity}
          label="Overall course progress"
          value={data.totalLessons ? `${data.overallProgress}%` : "—"}
          detail={data.totalLessons ? "Across enrolled courses" : "Available after lessons are published"}
          tone="violet"
        />
        <StudentStatCard
          Icon={Target}
          label="Quiz average"
          value={data.quizAverage === null ? "—" : `${data.quizAverage}%`}
          detail={
            data.quizAverage === null
              ? "No graded quiz results yet"
              : `${data.quizAttemptCount} submitted attempts`
          }
          tone="amber"
        />
        <StudentStatCard
          Icon={Award}
          label="Certificates earned"
          value={data.certificateCount}
          detail="Issued certificates"
          tone="rose"
        />
        <StudentStatCard
          Icon={Flame}
          label="Learning streak"
          value={`${data.currentStreak} ${data.currentStreak === 1 ? "day" : "days"}`}
          detail="Based on completed lessons and submitted quizzes"
          tone="orange"
        />
      </section>

      <section className="student-dashboard-grid">
        <div className="student-dashboard-main">
          <section className="student-panel">
            <header className="student-panel-heading">
              <div>
                <p className="student-eyebrow">Pick up where you left off</p>
                <h2>Continue learning</h2>
              </div>
              <Link className="student-inline-link" href="/student/courses">
                My courses <span aria-hidden="true">→</span>
              </Link>
            </header>
            {data.courses.length ? (
              <div className="student-course-list">
                {data.courses.map((course) => (
                  <StudentCourseCard course={course} compact key={course.id} />
                ))}
              </div>
            ) : (
              <StudentNoCoursesMessage />
            )}
          </section>

          <section className="student-panel">
            <header className="student-panel-heading">
              <div>
                <p className="student-eyebrow">A record of real work</p>
                <h2>Recent activity</h2>
              </div>
              <Link className="student-inline-link" href="/student/activity">
                View history <span aria-hidden="true">→</span>
              </Link>
            </header>
            <StudentActivityList
              activities={data.activity}
              timeZone={data.goals.timezone}
            />
          </section>
        </div>

        <aside className="student-dashboard-aside">
          <section className="student-panel student-goal-summary">
            <div className="student-panel-heading">
              <div>
                <p className="student-eyebrow">This week</p>
                <h2>Your learning goal</h2>
              </div>
              <Target size={19} aria-hidden="true" />
            </div>
            <p className="student-goal-count">
              <strong>{data.weeklyCompletedLessons}</strong>
              <span>of {data.goals.weekly_lesson_target} lessons completed</span>
            </p>
            <Progress
              value={Math.min(
                100,
                Math.round(
                  (data.weeklyCompletedLessons / data.goals.weekly_lesson_target) *
                    100,
                ),
              )}
              label="Weekly lesson goal progress"
            />
            <div className="student-goal-today">
              <span>Today&apos;s daily target</span>
              <strong>
                {data.todayCompletedLessons} / {data.goals.daily_lesson_target} lessons
              </strong>
            </div>
            <Link className="student-inline-link" href="/student/goals">
              Manage goals <span aria-hidden="true">→</span>
            </Link>
          </section>

          <section className="student-panel student-streak-panel">
            <span className="student-streak-icon"><Flame size={20} aria-hidden="true" /></span>
            <div>
              <p className="student-eyebrow">Keep your rhythm</p>
              <h2>{data.currentStreak} day learning streak</h2>
              <p>
                Streaks count days with a completed lesson or submitted quiz. Opening
                this dashboard never adds activity.
              </p>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
