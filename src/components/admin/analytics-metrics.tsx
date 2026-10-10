import { formatSteps } from "@/lib/steps/model";
import { percentText, type Metrics } from "@/lib/admin/model";

export function AnalyticsMetrics({
  metrics,
  system = false,
}: {
  metrics: Metrics & { coach_count?: number };
  system?: boolean;
}) {
  const values: [string, string][] = [
    ...(system
      ? [["מאמנים", formatSteps(metrics.coach_count ?? 0)] as [string, string]]
      : []),
    ["מתאמנים", formatSteps(metrics.trainee_count)],
    ["מתאמנים פעילים", formatSteps(metrics.active_trainee_count)],
    ["אחוז דיווח", percentText(metrics.reporting_rate)],
    ["אחוז עמידה ביעד", percentText(metrics.target_attainment_rate)],
    ["ממוצע השלמת יעד", percentText(metrics.average_completion)],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {values.map(([label, value]) => (
        <div key={label} className="rounded-xl border bg-card p-4">
          <dt className="mb-2 text-sm text-muted-foreground">{label}</dt>
          <dd className="text-2xl font-bold tabular-nums">
            <span dir="ltr">{value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function TraineeAnalyticsMetrics({ metrics }: { metrics: Metrics }) {
  return (
    <dl className="space-y-2 text-sm">
      <div>
        <dt className="inline font-semibold">דיווח: </dt>
        <dd className="inline">
          {metrics.expected_days === 0
            ? "—"
            : `${formatSteps(metrics.reported_days)} מתוך ${formatSteps(metrics.expected_days)} ימים (${percentText(metrics.reporting_rate)})`}
        </dd>
      </div>
      <div>
        <dt className="inline font-semibold">עמידה ביעד: </dt>
        <dd className="inline">
          {metrics.eligible_reported_days === 0
            ? "—"
            : `${formatSteps(metrics.target_reached_days)} מתוך ${formatSteps(metrics.eligible_reported_days)} ימים שדווחו עם יעד (${percentText(metrics.target_attainment_rate)})`}
        </dd>
      </div>
      <div>
        <dt className="inline font-semibold">ממוצע השלמת יעד: </dt>
        <dd className="inline">
          <span dir="ltr">{percentText(metrics.average_completion)}</span>
        </dd>
      </div>
    </dl>
  );
}
