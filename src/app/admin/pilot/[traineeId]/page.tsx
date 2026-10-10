import { requireRole } from "@/lib/auth/session";
import { pilotWeek } from "@/lib/pilot/model";
import { loadPilotDetail } from "@/lib/pilot/server";
import { historyPage } from "@/lib/coaching/model";
import { ReportWorkspace } from "@/components/pilot/report-workspace";
import { DataLoadError } from "@/components/shared/data-load-error";
export default async function AdminPilotDetail({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ reportWeek?: string; reportPage?: string }>;
}) {
  await requireRole("admin");
  const { traineeId } = await params;
  const query = await searchParams;
  const data = await loadPilotDetail(
    traineeId,
    pilotWeek(query.reportWeek),
    true,
    historyPage(query.reportPage),
  );
  return data ? (
    <ReportWorkspace
      key={data.week}
      data={data}
      basePath={`/admin/pilot/${traineeId}`}
    />
  ) : (
    <DataLoadError message="לא הצלחנו לטעון את הדיווח." />
  );
}
