import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";

function shortDate(dateKey, timeZone, includeMonth) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: includeMonth ? "short" : undefined,
    day: "numeric",
    timeZone,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export default function StudentLearningChart({
  data,
  timeZone,
  range,
}) {
  const totalActions = data.reduce(
    (sum, point) => sum + point.lessons + point.quizzes,
    0,
  );
  const maxValue = Math.max(
    1,
    ...data.map((point) => point.lessons + point.quizzes),
  );
  const labelStep = range <= 7 ? 1 : range <= 30 ? 5 : 14;

  if (!totalActions) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No activity in this range"
        description="Completed lessons and submitted quizzes will be charted here."
      />
    );
  }

  return (
    <div
      className="student-learning-chart"
      role="img"
      aria-label={`Learning activity during the last ${range} days: ${totalActions} recorded lessons and quiz submissions`}
    >
      <div className="student-chart-legend">
        <span><i className="chart-lesson" /> Lessons completed</span>
        <span><i className="chart-quiz" /> Quizzes submitted</span>
      </div>
      <div className="student-chart-plot">
        <div className="student-chart-y-labels" aria-hidden="true">
          <span>{maxValue}</span>
          <span>{Math.ceil(maxValue / 2)}</span>
          <span>0</span>
        </div>
        <div
          className="student-chart-columns"
          style={{
            gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
          }}
        >
          {data.map((point, index) => {
            const showLabel =
              index % labelStep === 0 || index === data.length - 1;
            const dateLabel = shortDate(point.date, timeZone, range > 7);
            return (
              <div className="student-chart-day" key={point.date}>
                <div
                  className="student-chart-bars"
                  title={`${dateLabel}: ${point.lessons} lessons completed, ${point.quizzes} quizzes submitted`}
                >
                  <span
                    className="student-chart-bar chart-lesson"
                    style={{ height: `${(point.lessons / maxValue) * 100}%` }}
                  />
                  <span
                    className="student-chart-bar chart-quiz"
                    style={{ height: `${(point.quizzes / maxValue) * 100}%` }}
                  />
                </div>
                <span className="student-chart-date" aria-hidden="true">
                  {showLabel ? dateLabel : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="student-chart-caption">
        Based on recorded lesson completions and quiz submissions. Learning time is not tracked.
      </p>
    </div>
  );
}
