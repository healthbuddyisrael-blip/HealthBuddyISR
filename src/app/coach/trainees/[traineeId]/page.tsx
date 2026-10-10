import { DataLoadError } from "@/components/shared/data-load-error";
import { TraineeDetail } from "@/components/coach/trainee-detail";
import { requireRole } from "@/lib/auth/session";
import { loadCoachDetail } from "@/lib/coach/server";
import { businessDate, selectedWeek } from "@/lib/steps/model";
import { historyPage } from "@/lib/coaching/model";

export default async function TraineeDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{
    month?: string | string[];
    week?: string | string[];
    callsPage?: string | string[];
  }>;
}) {
  await requireRole("coach");
  const { traineeId } = await params;
  const today = businessDate();
  const search = await searchParams;
  const week = selectedWeek(search.week, today, search.month);
  const data = await loadCoachDetail(
    traineeId,
    week,
    today,
    historyPage(search.callsPage),
  );
  if (!data)
    return <DataLoadError message="לא הצלחנו לטעון את פרטי המתאמן. נסו שוב." />;
  return <TraineeDetail traineeId={traineeId} week={week} {...data} />;
}
