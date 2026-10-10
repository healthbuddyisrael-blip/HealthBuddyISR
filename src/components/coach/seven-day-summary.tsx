import { formatSteps } from "@/lib/steps/model";
import type { sevenDaySummary } from "@/lib/coach/model";

export function SevenDaySummary({
  summary,
}: {
  summary: ReturnType<typeof sevenDaySummary>;
}) {
  return (
    <section
      aria-labelledby="summary-heading"
      className="rounded-2xl border bg-card p-5"
    >
      <h2 id="summary-heading" className="mb-4 text-lg font-bold">
        7 ימים אחרונים
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">ימים שדווחו</dt>
          <dd className="font-semibold">{summary.reportedDays} מתוך 7</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">ימים שבהם היעד הושג</dt>
          <dd className="font-semibold">
            {summary.eligibleDays === 0
              ? "אין ימים עם דיווח ויעד"
              : `${summary.reachedDays} מתוך ${summary.eligibleDays} ימים ${summary.eligibleDays === summary.reportedDays ? "שדווחו" : "עם דיווח ויעד"}`}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            ממוצע צעדים · ימים שדווחו בלבד
          </dt>
          <dd className="font-semibold">
            {summary.averageSteps === null
              ? "טרם דווח"
              : formatSteps(summary.averageSteps)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            ממוצע השלמת יעד · ימים עם דיווח ויעד
          </dt>
          <dd className="font-semibold">
            {summary.averageCompletion === null ? (
              "—"
            ) : (
              <span dir="ltr">{summary.averageCompletion}%</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
