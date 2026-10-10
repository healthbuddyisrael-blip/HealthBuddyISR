import Form from "next/form";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { businessDate, formatDate } from "@/lib/steps/model";
import { shiftDate } from "@/lib/coach/model";
import {
  coachingQuery,
  coachingWeekStart,
  coachingHref,
  coachingFilters,
} from "@/lib/coaching/model";
import { loadCoachingOverview } from "@/lib/coaching/server";
import { CoachingSummary } from "@/components/coaching/oversight-summary";
import { CoachingOversightTable } from "@/components/coaching/oversight-table";
import { DataLoadError } from "@/components/shared/data-load-error";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function CoachingOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string | string[];
    filter?: string | string[];
    page?: string | string[];
  }>;
}) {
  await requireRole("admin");
  const today = businessDate(),
    query = coachingQuery(await searchParams, today);
  const data = await loadCoachingOverview(query.week, query.filter, query.page);
  if (!data)
    return (
      <DataLoadError message="לא הצלחנו לטעון את השיחות השבועיות. נסו שוב." />
    );
  const labels = {
    all: "הכול",
    missing: "שיחות חסרות",
    attention: "נדרשת תשומת לב",
    completed: "הושלמו",
  };
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">פיקוח שיחות שבועיות</h1>
      <p>
        {formatDate(data.week_start)} – {formatDate(data.week_end)}
      </p>
      <CoachingSummary summary={data.summary} />
      <p className="text-sm text-muted-foreground">
        שיחה אישית אחת וסיכום קצר לכל מתאמן בשבוע (שני–ראשון). השבוע הנוכחי
        מסתיים ביום ראשון; שיחות חסרות משבועות שהסתיימו מסומנות באיחור. הסיכום
        כולל את כל המתאמנים הצפויים בשבוע הנבחר, ללא קשר למסנן.
      </p>
      <nav aria-label="בחירת שבוע" className="flex flex-wrap gap-3">
        <Link
          className="inline-flex min-h-12 items-center underline"
          href={coachingHref(shiftDate(query.week, -7), query.filter)}
        >
          שבוע קודם
        </Link>
        {query.week < coachingWeekStart(today) && (
          <>
            <Link
              className="inline-flex min-h-12 items-center underline"
              href={coachingHref(shiftDate(query.week, 7), query.filter)}
            >
              שבוע הבא
            </Link>
            <Link
              className="inline-flex min-h-12 items-center underline"
              href={coachingHref(coachingWeekStart(today), query.filter)}
            >
              השבוע הנוכחי
            </Link>
          </>
        )}
      </nav>
      <Form
        action="/admin/coaching"
        className="flex flex-wrap items-end gap-3"
        key={query.week}
      >
        <label className="text-sm font-semibold">
          בחירת תאריך בשבוע
          <Input
            type="date"
            name="week"
            defaultValue={query.week}
            max={today}
            required
          />
        </label>
        <input type="hidden" name="filter" value={query.filter} />
        <Button type="submit" variant="outline">
          הצגה
        </Button>
      </Form>
      <nav aria-label="מסנן מצב שיחות" className="flex flex-wrap gap-2">
        {coachingFilters.map((filter) => (
          <Button
            key={filter}
            asChild
            variant={filter === query.filter ? "default" : "outline"}
          >
            <Link
              href={coachingHref(query.week, filter)}
              aria-current={filter === query.filter ? "page" : undefined}
            >
              {labels[filter]}
            </Link>
          </Button>
        ))}
      </nav>
      <CoachingOversightTable trainees={data.trainees} />
      <Pagination
        previous={
          query.page > 1
            ? coachingHref(query.week, query.filter, query.page - 1)
            : undefined
        }
        next={
          data.total > query.page * 25
            ? coachingHref(query.week, query.filter, query.page + 1)
            : undefined
        }
      />
    </div>
  );
}
