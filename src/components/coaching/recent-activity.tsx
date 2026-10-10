import { formatSteps } from "@/lib/steps/model";
import type { CoachingHistoryData } from "@/lib/coaching/model";

export function RecentCallActivity({ data }: { data: CoachingHistoryData }) {
  const a = data.recent_activity;
  return (
    <aside
      className="rounded-xl bg-muted p-3 text-sm"
      aria-label="פעילות לקראת השיחה"
    >
      <p className="font-semibold">7 הימים האחרונים, עד היום</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <p>
          ממוצע צעדים:{" "}
          {a.average_daily_steps === null
            ? "—"
            : formatSteps(Math.round(a.average_daily_steps))}{" "}
          ({a.step_days}/7 ימים)
        </p>
        <p>
          יעד צעדים נוכחי:{" "}
          {data.step_target === null ? "—" : formatSteps(data.step_target)}
        </p>
        <p>
          אימוני כוח: {a.strength_days === 0 ? "—" : a.strength_sessions} (
          {a.strength_days}/7 ימים ידועים)
        </p>
        <p>
          אימוני אירובי: {a.cardio_days === 0 ? "—" : a.cardio_sessions} (
          {a.cardio_days}/7 ימים ידועים)
        </p>
      </div>
      <p className="mt-2 text-muted-foreground">
        ימים שלא דווחו אינם אפס. הספירות כוללות דיווחים ידועים בלבד.
      </p>
    </aside>
  );
}
