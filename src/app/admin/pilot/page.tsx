import Form from "next/form";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { businessDate } from "@/lib/steps/model";
import { pilotWeek } from "@/lib/pilot/model";
import { historyPage } from "@/lib/coaching/model";
import { loadPilotOverview } from "@/lib/pilot/server";
import { PilotOverviewTable } from "@/components/pilot/overview";
import { PilotEnrollment } from "@/components/pilot/enrollment";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataLoadError } from "@/components/shared/data-load-error";
export default async function AdminPilotPage({
  searchParams,
}: {
  searchParams: Promise<{ reportWeek?: string; page?: string; q?: string }>;
}) {
  await requireRole("admin");
  const query = await searchParams;
  const today = businessDate();
  const week = pilotWeek(query.reportWeek, today);
  const page = historyPage(query.page);
  const client = await createClient();
  const search = typeof query.q === "string" ? query.q.slice(0, 100) : "";
  let profiles = client
    .from("profiles")
    .select("id,full_name")
    .eq("role", "trainee")
    .order("full_name")
    .limit(25);
  if (search)
    profiles = profiles.ilike(
      "full_name",
      `%${search.replace(/[%_\\]/g, "")}%`,
    );
  const [data, options] = await Promise.all([
    loadPilotOverview(week, page),
    profiles,
  ]);
  if (!data || options.error)
    return <DataLoadError message="לא הצלחנו לטעון את הפיילוט." />;
  const enrollment = options.data.length
    ? await client
        .from("pilot_participants")
        .select("trainee_id,starts_on,ends_on")
        .in(
          "trainee_id",
          options.data.map((p) => p.id),
        )
    : { data: [], error: null };
  if (enrollment.error)
    return <DataLoadError message="לא הצלחנו לטעון את שיוכי הפיילוט." />;
  const enrollmentOptions = options.data.map((p) => ({
    ...p,
    membership:
      (enrollment.data ?? []).find((m) => m.trainee_id === p.id) ?? null,
  }));
  return (
    <div className="space-y-8">
      <PilotOverviewTable data={data} admin today={today} page={page} />
      <section className="space-y-3">
        <Form action="/admin/pilot" className="flex gap-3">
          <input type="hidden" name="reportWeek" value={week} />
          <label className="flex-1">
            חיפוש משתתף לשיוך (עד 25 תוצאות)
            <Input name="q" defaultValue={search} />
          </label>
          <Button variant="outline">חיפוש</Button>
        </Form>
        <PilotEnrollment options={enrollmentOptions} start={week} />
      </section>
    </div>
  );
}
