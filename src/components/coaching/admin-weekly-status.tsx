import Link from "next/link";
import { businessDate, formatDate } from "@/lib/steps/model";
import { coachingWeekStart } from "@/lib/coaching/model";
import { loadCoachingOverview } from "@/lib/coaching/server";
import { CoachingSummary } from "./oversight-summary";

export async function AdminWeeklyStatus() {
  const data = await loadCoachingOverview(
    coachingWeekStart(businessDate()),
    "all",
    1,
  );
  return (
    <section className="space-y-3" aria-label="מצב שיחות שבועיות">
      <h2 className="text-xl font-bold">מצב שיחות שבועיות</h2>
      {data ? (
        <>
          <p className="text-sm">
            {formatDate(data.week_start)} – {formatDate(data.week_end)}
          </p>
          <CoachingSummary summary={data.summary} />
        </>
      ) : (
        <p role="alert">נתוני השיחות השבועיות אינם זמינים כרגע.</p>
      )}
      <Link
        href="/admin/coaching"
        className="inline-flex min-h-12 items-center font-semibold underline"
      >
        כל המתאמנים, שיחות חסרות ומקרים לתשומת לב
      </Link>
    </section>
  );
}
