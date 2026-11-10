import Link from "next/link";
import { Flame, Target } from "lucide-react";
import { StudentPageHeader, StudentStatCard } from "@/components/student/student-components";
import { StudentLearningGoalsForm } from "@/components/student/student-forms";
import { getStudentGoalsPageData } from "@/lib/student/data";
import { Progress } from "@/components/ui/indicators";

export const metadata = {
  title: "Learning goals",
  robots: { index: false, follow: false },
};

export default async function StudentGoalsPage() {
  const data = await getStudentGoalsPageData();
  const dailyPercent = Math.min(
    100,
    Math.round((data.today / data.goals.daily_lesson_target) * 100),
  );
  const weeklyPercent = Math.min(
    100,
    Math.round((data.week / data.goals.weekly_lesson_target) * 100),
  );

  return (
    <div className="student-page">
      <StudentPageHeader
        eyebrow="Build a sustainable rhythm"
        title="Learning goals"
        description="Goals count only recorded lesson completions. A visit to this page never adds progress or earns a streak."
      />

      <section className="student-stat-grid student-goal-stats">
        <StudentStatCard
          Icon={Target}
          label="Completed today"
          value={`${data.today} / ${data.goals.daily_lesson_target}`}
          detail="Lessons completed in your timezone"
          tone="green"
        />
        <StudentStatCard
          Icon={Target}
          label="Completed this week"
          value={`${data.week} / ${data.goals.weekly_lesson_target}`}
          detail="Week starts on Monday"
          tone="blue"
        />
        <StudentStatCard
          Icon={Flame}
          label="Current streak"
          value={`${data.streak} ${data.streak === 1 ? "day" : "days"}`}
          detail={`Longest recorded: ${data.longestStreak} ${data.longestStreak === 1 ? "day" : "days"}`}
          tone="orange"
        />
      </section>

      <section className="student-goal-progress-grid">
        <article className="student-panel student-goal-progress-card">
          <div className="student-panel-heading">
            <div>
              <p className="student-eyebrow">{data.todayKey}</p>
              <h2>Today&apos;s target</h2>
            </div>
            <Target size={20} aria-hidden="true" />
          </div>
          <Progress
            value={dailyPercent}
            label={`${data.today} of ${data.goals.daily_lesson_target} lessons completed`}
            showValue
          />
          <p>
            {Math.max(0, data.goals.daily_lesson_target - data.today)} lessons left to reach today&apos;s goal.
          </p>
        </article>
        <article className="student-panel student-goal-progress-card">
          <div className="student-panel-heading">
            <div>
              <p className="student-eyebrow">Monday through Sunday</p>
              <h2>This week&apos;s target</h2>
            </div>
            <Flame size={20} aria-hidden="true" />
          </div>
          <Progress
            value={weeklyPercent}
            label={`${data.week} of ${data.goals.weekly_lesson_target} lessons completed`}
            showValue
          />
          <p>
            {Math.max(0, data.goals.weekly_lesson_target - data.week)} lessons left to reach this week&apos;s goal.
          </p>
        </article>
      </section>

      <section className="student-panel">
        <header className="student-panel-heading">
          <div>
            <p className="student-eyebrow">Personalize your routine</p>
            <h2>Goal and timezone settings</h2>
          </div>
        </header>
        <StudentLearningGoalsForm goals={data.goals} />
      </section>

      <p className="student-data-note">
        Current and longest streaks are calculated from completed lessons and submitted quizzes.
        Only real event timestamps count. See <Link href="/student/progress">progress analytics</Link> for your recorded history.
      </p>
    </div>
  );
}
