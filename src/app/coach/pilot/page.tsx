import { requireRole } from "@/lib/auth/session";
import { businessDate } from "@/lib/steps/model";
import { pilotWeek } from "@/lib/pilot/model";
import { historyPage } from "@/lib/coaching/model";
import { loadPilotOverview } from "@/lib/pilot/server";
import { PilotOverviewTable } from "@/components/pilot/overview";
import { DataLoadError } from "@/components/shared/data-load-error";
export default async function CoachPilotPage({
  searchParams,
}: {
  searchParams: Promise<{ reportWeek?: string; page?: string }>;
}) {
  await requireRole("coach");
  const query = await searchParams;
  const today = businessDate();
  const page = historyPage(query.page);
  const data = await loadPilotOverview(
    pilotWeek(query.reportWeek, today),
    page,
  );
  return data ? (
    <PilotOverviewTable data={data} admin={false} today={today} page={page} />
  ) : (
    <DataLoadError message="לא הצלחנו לטעון את הדיווחים השבועיים." />
  );
}
