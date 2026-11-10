import { Skeleton } from "@/components/ui/indicators";

export default function StudentLoading() {
  return (
    <main className="student-page student-loading" aria-busy="true">
      <Skeleton className="student-loading-kicker" />
      <Skeleton className="student-loading-title" />
      <Skeleton className="student-loading-copy" />
      <div className="student-loading-stats">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="student-loading-stat" key={index} />
        ))}
      </div>
      <Skeleton className="student-loading-panel" />
    </main>
  );
}
