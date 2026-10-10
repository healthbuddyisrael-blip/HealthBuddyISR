import { DataLoadError } from "@/components/shared/data-load-error";
import { TraineeDashboard } from "@/components/steps/trainee-dashboard";
import { requireRole } from "@/lib/auth/session";
import { businessDate, selectedWeek } from "@/lib/steps/model";
import { loadDashboard } from "@/lib/steps/server";
import { pilotMembership, loadPilotDetail } from "@/lib/pilot/server";
import { pilotWeek } from "@/lib/pilot/model";
import { ReportWorkspace } from "@/components/pilot/report-workspace";
import { historyPage } from "@/lib/coaching/model";
import Link from "next/link";

export default async function TraineePage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string | string[];
    month?: string | string[];
    reportWeek?: string | string[];
    reportPage?: string | string[];
  }>;
}) {
  const profile = await requireRole("trainee");
  const today = businessDate();
  const search = await searchParams;
  const member = await pilotMembership(profile.id);
  if (
    member &&
    ((member.starts_on <= today &&
      (!member.ends_on || member.ends_on >= today)) ||
      search.reportWeek !== undefined)
  ) {
    const pilot = await loadPilotDetail(
      profile.id,
      pilotWeek(search.reportWeek, today),
      true,
      historyPage(search.reportPage),
    );
    return pilot ? (
      <ReportWorkspace
        key={pilot.week}
        data={pilot}
        basePath="/app"
        participant
      />
    ) : (
      <DataLoadError message="לא הצלחנו לטעון את הסיכומים השבועיים." />
    );
  }
  const week = selectedWeek(search.week, today, search.month);
  const data = await loadDashboard(profile.id, week, today);
  if (!data)
    return <DataLoadError message="לא הצלחנו לטעון את הצעדים. נסו שוב." />;
  return (
    <>
      {member && (
        <Link
          href={`/app?reportWeek=${member.starts_on}`}
          className="underline"
        >
          דיווחי הפיילוט הקודמים
        </Link>
      )}
      <TraineeDashboard name={profile.full_name} week={week} {...data} />
    </>
  );
}
