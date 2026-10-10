import Link from "next/link";
import type { z } from "zod";
import {
  percentText,
  type adminCoachSchema,
  type AnalyticsRange,
} from "@/lib/admin/model";
import { formatSteps } from "@/lib/steps/model";
import { analyticsHref } from "./analytics-controls";

export function CoachAnalyticsList({
  coaches,
  range,
}: {
  coaches: z.infer<typeof adminCoachSchema>[];
  range: AnalyticsRange;
}) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {coaches.map((coach) => (
        <li key={coach.coach_id} className="min-w-0">
          <Link
            href={analyticsHref(`/admin/coaches/${coach.coach_id}`, range)}
            aria-label={`צפייה במאמן ${coach.full_name}`}
            className="block h-full space-y-3 rounded-2xl border bg-card p-5 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <h3 className="text-lg font-bold">{coach.full_name}</h3>
            <p
              dir="ltr"
              className="break-all text-end text-sm text-muted-foreground"
            >
              {coach.email}
            </p>
            <p>
              {formatSteps(coach.trainee_count)} מתאמנים ·{" "}
              {formatSteps(coach.active_trainee_count)} פעילים
            </p>
            {coach.trainee_count === 0 ? (
              <p className="text-sm text-muted-foreground">
                למאמן הזה עדיין אין מתאמנים.
              </p>
            ) : (
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="inline font-semibold">דיווח: </dt>
                  <dd className="inline">
                    <span dir="ltr">{percentText(coach.reporting_rate)}</span>
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold">עמידה ביעד: </dt>
                  <dd className="inline">
                    <span dir="ltr">
                      {percentText(coach.target_attainment_rate)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold">ממוצע השלמת יעד: </dt>
                  <dd className="inline">
                    <span dir="ltr">
                      {percentText(coach.average_completion)}
                    </span>
                  </dd>
                </div>
              </dl>
            )}
            <span className="inline-block text-sm font-semibold underline">
              צפייה במאמן
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
