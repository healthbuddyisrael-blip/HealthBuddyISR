import { DataLoadError } from "@/components/shared/data-load-error";
import { Pagination } from "@/components/shared/pagination";
import Link from "next/link";
import Form from "next/form";
import { TraineeList } from "@/components/coach/trainee-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/lib/auth/session";
import { coachQuery } from "@/lib/coach/model";
import { loadCoachDashboard } from "@/lib/coach/server";
import { businessDate } from "@/lib/steps/model";

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[] }>;
}) {
  await requireRole("coach");
  const { page, search } = coachQuery(await searchParams);
  const data = await loadCoachDashboard(page, search);
  const pageHref = (value: number) =>
    `/coach?${new URLSearchParams({ page: String(value), q: search })}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">המתאמנים שלי</h1>
        <Button asChild variant="outline">
          <Link href="/coach/invitations">הזמנות למתאמנים</Link>
        </Button>
      </div>
      <Button asChild>
        <Link href="/coach/pilot">דיווח ומעקב שבועי בפיילוט</Link>
      </Button>
      <Form action="/coach" className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <label
            htmlFor="trainee-search"
            className="mb-2 block text-sm font-semibold"
          >
            חיפוש מתאמן
          </label>
          <Input
            id="trainee-search"
            type="search"
            name="q"
            defaultValue={search}
            maxLength={200}
          />
        </div>
        <Button type="submit" variant="outline">
          חיפוש
        </Button>
      </Form>
      {!data ? (
        <DataLoadError message="לא הצלחנו לטעון את המתאמנים. נסו שוב." />
      ) : data.total === 0 ? (
        <div className="rounded-2xl border bg-card p-6">
          <p className="mb-3">
            {search
              ? "לא נמצאו מתאמנים התואמים לחיפוש."
              : "עדיין אין לך מתאמנים."}
          </p>
          {!search && (
            <>
              <p className="mb-4 text-muted-foreground">
                אפשר להזמין מתאמן חדש כדי להתחיל.
              </p>
              <Button asChild>
                <Link href="/coach/invitations">הזמנת מתאמן</Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <TraineeList
            trainees={data.trainees}
            today={businessDate()}
            pilotIds={data.pilotIds}
          />
          {data.trainees.length === 0 && <p>אין מתאמנים בעמוד זה.</p>}
          <Pagination
            label="עמודי מתאמנים"
            previous={page > 1 ? pageHref(page - 1) : undefined}
            next={data.total > page * 25 ? pageHref(page + 1) : undefined}
          />
        </>
      )}
    </div>
  );
}
