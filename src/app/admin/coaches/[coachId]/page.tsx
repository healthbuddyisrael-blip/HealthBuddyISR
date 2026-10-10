import { DataLoadError } from "@/components/shared/data-load-error";
import Link from "next/link";
import { AnalyticsMetrics } from "@/components/admin/analytics-metrics";
import {
  AnalyticsPagination,
  AnalyticsSearch,
  RangeControls,
  analyticsHref,
} from "@/components/admin/analytics-controls";
import { TraineeAnalyticsList } from "@/components/admin/trainee-analytics-list";
import { requireRole } from "@/lib/auth/session";
import { adminQuery } from "@/lib/admin/model";
import { loadAdminCoach } from "@/lib/admin/server";

export default async function CoachDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ coachId: string }>;
  searchParams: Promise<{
    range?: string | string[];
    page?: string | string[];
    q?: string | string[];
  }>;
}) {
  await requireRole("admin");
  const { coachId } = await params;
  const query = adminQuery(await searchParams);
  const data = await loadAdminCoach(
    coachId,
    query.range,
    query.search,
    query.page,
  );
  if (!data)
    return <DataLoadError message="לא הצלחנו לטעון את נתוני המאמן. נסו שוב." />;
  const path = `/admin/coaches/${coachId}`;
  return (
    <div className="space-y-6">
      <Link
        href={analyticsHref("/admin", query.range)}
        className="inline-flex min-h-12 items-center underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        חזרה לסקירת המערכת
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{data.coach.full_name}</h1>
        <p dir="ltr" className="mt-2 break-all text-end text-muted-foreground">
          {data.coach.email}
        </p>
      </header>
      <RangeControls path={path} range={query.range} search={query.search} />
      {data.coach.trainee_count === 0 ? (
        <p className="rounded-2xl border bg-card p-6">
          למאמן הזה עדיין אין מתאמנים.
        </p>
      ) : (
        <>
          <section
            aria-label={`נתוני המאמן ל-${query.range} ימים אחרונים`}
            className="space-y-3"
          >
            <h2 className="text-lg font-semibold">
              {query.range} ימים אחרונים
            </h2>
            <AnalyticsMetrics metrics={data.coach} />
          </section>
          <section aria-labelledby="trainees-heading" className="space-y-4">
            <h2 id="trainees-heading" className="text-xl font-bold">
              מתאמנים
            </h2>
            <AnalyticsSearch
              path={path}
              range={query.range}
              search={query.search}
              label="חיפוש מתאמן לפי שם או אימייל"
            />
            {data.trainees.length === 0 ? (
              <p>לא נמצאו מתאמנים להצגה בעמוד זה.</p>
            ) : (
              <TraineeAnalyticsList
                trainees={data.trainees}
                coachId={coachId}
                today={data.today}
                range={query.range}
              />
            )}
            <AnalyticsPagination
              path={path}
              range={query.range}
              search={query.search}
              page={query.page}
              total={data.total}
            />
          </section>
        </>
      )}
    </div>
  );
}
