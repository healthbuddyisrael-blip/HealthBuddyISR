import Link from "next/link";
import type { z } from "zod";
import { ProgressRing } from "@/components/steps/progress-ring";
import { completion, formatSteps } from "@/lib/steps/model";
import { lastReported } from "@/lib/coach/model";
import type { adminTraineeSchema, AnalyticsRange } from "@/lib/admin/model";
import { TraineeAnalyticsMetrics } from "./analytics-metrics";
import { analyticsHref } from "./analytics-controls";

export function TraineeAnalyticsList({
  trainees,
  coachId,
  today,
  range,
}: {
  trainees: z.infer<typeof adminTraineeSchema>[];
  coachId: string;
  today: string;
  range: AnalyticsRange;
}) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {trainees.map((trainee) => (
        <li
          key={trainee.trainee_id}
          className="space-y-4 rounded-2xl border bg-card p-5"
        >
          <h3 className="text-lg font-bold">
            <Link
              href={analyticsHref(
                `/admin/coaches/${coachId}/trainees/${trainee.trainee_id}`,
                range,
              )}
              className="inline-flex min-h-12 items-center underline focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`נתוני המתאמן ${trainee.full_name}`}
            >
              {trainee.full_name}
            </Link>
          </h3>
          <div className="flex items-center justify-between gap-3">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="inline font-semibold">היום: </dt>
                <dd className="inline">
                  {trainee.today_steps === null
                    ? "לא דווח"
                    : `${formatSteps(trainee.today_steps)} צעדים`}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">יעד: </dt>
                <dd className="inline">
                  {trainee.today_target === null
                    ? "אין יעד זמין"
                    : `${formatSteps(trainee.today_target)} צעדים`}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">דיווח אחרון: </dt>
                <dd className="inline">
                  {lastReported(trainee.last_reported_date, today)}
                </dd>
              </div>
            </dl>
            <ProgressRing
              compact
              percentage={completion(trainee.today_steps, trainee.today_target)}
              emptyLabel={
                trainee.today_target === null ? "אין יעד זמין" : "לא דווח היום"
              }
            />
          </div>
          <div className="border-t pt-4">
            <h4 className="mb-3 font-semibold">{range} ימים אחרונים</h4>
            <TraineeAnalyticsMetrics metrics={trainee} />
          </div>
        </li>
      ))}
    </ul>
  );
}
