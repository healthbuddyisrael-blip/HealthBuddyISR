import Link from "next/link";
import { ProgressRing } from "@/components/steps/progress-ring";
import { completion, formatSteps } from "@/lib/steps/model";
import { lastReported, type coachDashboardSchema } from "@/lib/coach/model";
import type { z } from "zod";

export function TraineeList({
  trainees,
  today,
  pilotIds = [],
}: {
  trainees: z.infer<typeof coachDashboardSchema>["trainees"];
  today: string;
  pilotIds?: string[];
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {trainees.map((trainee) => (
        <li key={trainee.trainee_id} className="min-w-0">
          <Link
            href={`/coach/trainees/${trainee.trainee_id}`}
            aria-label={`פרטי המתאמן ${trainee.full_name}`}
            className="block h-full rounded-2xl border bg-card p-5 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <h2 className="mb-4 text-lg font-bold">{trainee.full_name}</h2>
            {pilotIds.includes(trainee.trainee_id) ? (
              <p>
                דיווח שבועי בפיילוט · הנתונים מוזנים על ידי המאמן. פתיחת הדיווח
                והיעד האישי.
              </p>
            ) : (
              <div className="flex items-center justify-between gap-4">
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
                  percentage={completion(
                    trainee.today_steps,
                    trainee.today_target,
                  )}
                  emptyLabel={
                    trainee.today_target === null
                      ? "אין יעד זמין"
                      : "לא דווח היום"
                  }
                />
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
