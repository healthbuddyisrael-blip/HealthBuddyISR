import { DataLoadError } from "@/components/shared/data-load-error";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { adminQuery } from "@/lib/admin/model";
import { loadAdminTrainee } from "@/lib/admin/server";
import { loadDashboard } from "@/lib/steps/server";
import { selectedWeek } from "@/lib/steps/model";
import {
  RangeControls,
  analyticsHref,
} from "@/components/admin/analytics-controls";
import { TraineeAnalyticsMetrics } from "@/components/admin/analytics-metrics";
import { ReadOnlyStepCalendar } from "@/components/steps/read-only-step-calendar";
import { ActivityProgress } from "@/components/activity/activity-progress";
import { BaselineForm } from "@/components/activity/baseline-form";
import LinkHistory from "@/components/coaching/trainee-call-history";

export default async function AdminTraineePage({
  params,
  searchParams,
}: {
  params: Promise<{ coachId: string; traineeId: string }>;
  searchParams: Promise<{
    range?: string | string[];
    month?: string | string[];
    week?: string | string[];
  }>;
}) {
  await requireRole("admin");
  const { coachId, traineeId } = await params;
  const search = await searchParams;
  const { range } = adminQuery(search);
  const data = await loadAdminTrainee(coachId, traineeId, range);
  if (!data)
    return (
      <DataLoadError message="לא הצלחנו לטעון את נתוני המתאמן. נסו שוב." />
    );
  const week = selectedWeek(search.week, data.today, search.month);
  const dashboard = await loadDashboard(traineeId, week, data.today);
  if (!dashboard)
    return (
      <DataLoadError message="לא הצלחנו לטעון את נתוני המתאמן. נסו שוב." />
    );
  const path = `/admin/coaches/${coachId}/trainees/${traineeId}`;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={analyticsHref(`/admin/coaches/${coachId}`, range)}
        className="inline-flex min-h-12 items-center underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        חזרה לנתוני המאמן
      </Link>
      <h1 className="text-2xl font-bold">{data.full_name}</h1>
      <RangeControls path={path} range={range} week={week} />
      <section
        className="rounded-2xl border bg-card p-5"
        aria-label={`נתוני המתאמן ל-${range} ימים אחרונים`}
      >
        <h2 className="mb-4 text-lg font-semibold">{range} ימים אחרונים</h2>
        <TraineeAnalyticsMetrics metrics={data} />
      </section>
      {!dashboard.activity.progress && <BaselineForm traineeId={traineeId} />}
      <ActivityProgress activity={dashboard.activity} />
      <LinkHistory traineeId={traineeId} />
      <ReadOnlyStepCalendar
        key={`${coachId}:${traineeId}:${week}`}
        days={dashboard.days}
        today={data.today}
        week={week}
        basePath={path}
        range={range}
      />
    </div>
  );
}
