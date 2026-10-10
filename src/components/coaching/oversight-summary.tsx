import type { CoachingOverviewData } from "@/lib/coaching/model";
export function CoachingSummary({
  summary,
}: {
  summary: CoachingOverviewData["summary"];
}) {
  const metrics = [
    ["מתאמנים פעילים", summary.active_trainees],
    ["שיחות הושלמו", summary.calls_completed],
    ["שיחות חסרות", summary.calls_missing],
    ["מקרים לתשומת לב", summary.attention_cases],
    [
      "עמידה בדרישה",
      summary.compliance_percentage === null
        ? "—"
        : `${new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 }).format(summary.compliance_percentage)}%`,
    ],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-xl border bg-card p-3">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-xl font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
