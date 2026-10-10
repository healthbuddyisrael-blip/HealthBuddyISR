import { DataLoadError } from "@/components/shared/data-load-error";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnalyticsMetrics } from "@/components/admin/analytics-metrics";
import {
  AnalyticsPagination,
  AnalyticsSearch,
  RangeControls,
} from "@/components/admin/analytics-controls";
import { CoachAnalyticsList } from "@/components/admin/coach-analytics-list";
import { requireRole } from "@/lib/auth/session";
import { adminQuery } from "@/lib/admin/model";
import { loadAdminOverview } from "@/lib/admin/server";
import { PilotSummary } from "@/components/activity/pilot-summary";
import { AdminWeeklyStatus } from "@/components/coaching/admin-weekly-status";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    range?: string | string[];
    q?: string | string[];
  }>;
}) {
  await requireRole("admin");
  const query = adminQuery(await searchParams);
  const data = await loadAdminOverview(query.range, query.search, query.page);
  if (!data)
    return (
      <DataLoadError message="לא הצלחנו לטעון את נתוני המערכת. נסו שוב." />
    );
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">סקירת מערכת</h1>
      <Button asChild>
        <Link href="/admin/pilot">מעקב דיווחים שבועיים בפיילוט</Link>
      </Button>
      <AdminWeeklyStatus />
      <RangeControls path="/admin" range={query.range} search={query.search} />
      <PilotSummary />
      <section
        aria-label={`נתוני מערכת ל-${query.range} ימים אחרונים`}
        className="space-y-4"
      >
        <h2 className="text-lg font-semibold">{query.range} ימים אחרונים</h2>
        <AnalyticsMetrics metrics={data.summary} system />
        <p className="text-sm text-muted-foreground">
          פעילות כוללת גם דיווח עם אפס צעדים. דיווח נמדד ביחס לימי חברות עם יעד;
          עמידה והשלמה נמדדות בימים שדווחו עם יעד.
        </p>
      </section>
      <section aria-labelledby="coaches-heading" className="space-y-4">
        <h2 id="coaches-heading" className="text-xl font-bold">
          מאמנים
        </h2>
        <AnalyticsSearch
          path="/admin"
          range={query.range}
          search={query.search}
          label="חיפוש מאמן לפי שם או אימייל"
        />
        {data.total === 0 ? (
          <div className="rounded-2xl border bg-card p-6">
            <p>
              {query.search
                ? "לא נמצאו מאמנים התואמים לחיפוש."
                : "עדיין אין מאמנים במערכת."}
            </p>
            {!query.search && (
              <Button asChild className="mt-4">
                <Link href="/admin/invitations">הזמנת מאמן</Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            <CoachAnalyticsList coaches={data.coaches} range={query.range} />
            {data.coaches.length === 0 && <p>אין מאמנים בעמוד זה.</p>}
            <AnalyticsPagination
              path="/admin"
              range={query.range}
              search={query.search}
              page={query.page}
              total={data.total}
            />
          </>
        )}
      </section>
      <Button asChild variant="outline">
        <Link href="/admin/invitations">הזמנת מאמן וניהול הזמנות</Link>
      </Button>
    </div>
  );
}
