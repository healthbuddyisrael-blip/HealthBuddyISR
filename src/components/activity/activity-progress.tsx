import { activityChange, type ActivityData } from "@/lib/activity/model";
import { formatDate } from "@/lib/steps/model";

const number = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 }).format(
        value,
      );
export function ActivityProgress({ activity }: { activity: ActivityData }) {
  const p = activity.progress;
  const metrics = p
    ? [
        {
          label: "ממוצע צעדים יומי",
          workout: false,
          baseline: p.baseline.baseline_average_daily_steps,
          current: p.current.average_daily_steps,
        },
        {
          label: "ממוצע אימוני כוח לשבוע",
          workout: true,
          baseline: p.baseline.baseline_strength_sessions_per_week,
          current: p.current.strength_sessions_per_week,
        },
        {
          label: "ממוצע אימוני אירובי לשבוע",
          workout: true,
          baseline: p.baseline.baseline_cardio_sessions_per_week,
          current: p.current.cardio_sessions_per_week,
        },
      ]
    : [];
  const days = p
    ? Math.max(
        0,
        Math.round(
          (new Date(p.window_end).getTime() -
            new Date(p.window_start).getTime()) /
            86400000,
        ) + 1,
      )
    : 0;
  return (
    <section
      className="space-y-4 rounded-2xl border bg-card p-5"
      aria-label="התקדמות פעילות"
    >
      <h2 className="text-xl font-bold">התקדמות פעילות</h2>
      {!p ? (
        <p>נתוני הפתיחה טרם הוגדרו על ידי המאמן.</p>
      ) : (
        <>
          <p className="text-sm">
            {p.completed
              ? "סיום תוכנית: 14 הימים האחרונים"
              : "פעילות נוכחית: עד 14 הימים האחרונים בתוכנית"}
          </p>
          <p className="text-sm text-muted-foreground">
            {days === 0
              ? `התוכנית תתחיל ב-${formatDate(p.baseline.program_start)}`
              : `${formatDate(p.window_start)} – ${formatDate(p.window_end)}`}
          </p>
          <div
            className="rounded-xl bg-muted p-3 text-sm"
            aria-label="אימונים שדווחו בתקופה"
          >
            <p className="font-semibold">אימונים שדווחו בתקופה המוצגת</p>
            <p>אימוני כוח: {p.current.strength_sessions}</p>
            <p>אימוני אירובי: {p.current.cardio_sessions}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <caption className="sr-only">
                השוואת פעילות מול נתוני הפתיחה
              </caption>
              <thead>
                <tr>
                  {[
                    "מדד",
                    "פתיחה",
                    p.completed ? "סיום" : "נוכחי",
                    "שינוי",
                  ].map((label) => (
                    <th key={label} scope="col" className="p-2 text-start">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  // Also protect against an older database during rollout.
                  const current = !m.workout || days >= 7 ? m.current : null;
                  const change = activityChange(m.baseline, current).absolute;
                  return (
                    <tr key={m.label} className="border-t">
                      <th scope="row" className="p-2 text-start font-normal">
                        {m.label}
                      </th>
                      <td className="p-2">{number(m.baseline)}</td>
                      <td className="p-2">{number(current)}</td>
                      <td dir="ltr" className="p-2">
                        {change === null
                          ? "—"
                          : `${change > 0 ? "+" : ""}${number(change)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            כיסוי דיווחים: צעדים {p.current.step_days}/{days}, כוח{" "}
            {p.current.strength_days}/{days}, אירובי {p.current.cardio_days}/
            {days}. ממוצע צעדים מבוסס על ימים שדווחו בלבד. תדירות אימונים זמינה
            רק אחרי 7 ימים לפחות וכשכל ימי החלון ידועים; נתונים חסרים אינם אפס.
          </p>
          {p.current.step_days < days && (
            <p className="text-sm">ממוצע הצעדים חלקי בשל דיווחים חסרים.</p>
          )}
          <p className="text-sm text-muted-foreground">
            נתוני פתיחה: {formatDate(p.baseline.baseline_period_start)} –{" "}
            {formatDate(p.baseline.baseline_period_end)}. מקור צעדים:{" "}
            {p.baseline.steps_source === "historical"
              ? "7 דיווחים היסטוריים"
              : "ראיון / הזנה ידנית"}
            .
          </p>
        </>
      )}
      <h3 className="font-semibold">פעילות בשבוע הנבחר (ראשון–שבת)</h3>
      {activity.weeks.length === 0 ? (
        <p>אין דיווחים בשבועות אלה.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr>
                {[
                  "תחילת שבוע",
                  "צעדים / ימים",
                  "כוח / ימים ידועים",
                  "אירובי / ימים ידועים",
                ].map((label) => (
                  <th key={label} scope="col" className="p-2 text-start">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.weeks.map((w) => (
                <tr key={w.week_start} className="border-t">
                  <th scope="row" className="p-2 text-start font-normal">
                    {formatDate(w.week_start)}
                  </th>
                  <td className="p-2">
                    {number(w.average_daily_steps)} ({w.step_days}/7)
                  </td>
                  <td className="p-2">
                    {number(w.strength_sessions)} ({w.strength_days}/7)
                  </td>
                  <td className="p-2">
                    {number(w.cardio_sessions)} ({w.cardio_days}/7)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        כל יום שסומן נספר כאימון אחד. הספירות השבועיות כוללות רק דיווחים ידועים,
        כולל שבועות חלקיים.
      </p>
    </section>
  );
}
