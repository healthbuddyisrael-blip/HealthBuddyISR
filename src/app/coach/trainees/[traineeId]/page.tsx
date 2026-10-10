import { DataLoadError } from "@/components/shared/data-load-error";
import { TraineeDetail } from "@/components/coach/trainee-detail";
import { requireRole } from "@/lib/auth/session";
import { loadCoachDetail } from "@/lib/coach/server";
import { businessDate, selectedWeek } from "@/lib/steps/model";
import { historyPage } from "@/lib/coaching/model";
import { pilotMembership, loadPilotDetail } from "@/lib/pilot/server";
import { pilotWeek } from "@/lib/pilot/model";
import { ReportWorkspace } from "@/components/pilot/report-workspace";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { z } from "zod";

export default async function TraineeDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{
    month?: string | string[];
    week?: string | string[];
    callsPage?: string | string[];
    reportWeek?: string | string[];
    reportPage?: string | string[];
  }>;
}) {
  const coach = await requireRole("coach");
  const { traineeId } = await params;
  const today = businessDate();
  const search = await searchParams;
  if (!z.uuid().safeParse(traineeId).success) notFound();
  const client = await createClient();
  const ownership = await client
    .from("coach_trainees")
    .select("trainee_id")
    .eq("coach_id", coach.id)
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (ownership.error)
    return <DataLoadError message="לא הצלחנו לבדוק את שיוך המתאמן." />;
  if (!ownership.data) notFound();
  const member = await pilotMembership(traineeId);
  if (
    member &&
    ((member.starts_on <= today &&
      (!member.ends_on || member.ends_on >= today)) ||
      search.reportWeek !== undefined)
  ) {
    const pilot = await loadPilotDetail(
      traineeId,
      pilotWeek(search.reportWeek, today),
      false,
      historyPage(search.reportPage),
    );
    return pilot ? (
      <ReportWorkspace
        key={pilot.week}
        data={pilot}
        basePath={`/coach/trainees/${traineeId}`}
      />
    ) : (
      <DataLoadError message="לא הצלחנו לטעון את הדיווח השבועי." />
    );
  }
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
