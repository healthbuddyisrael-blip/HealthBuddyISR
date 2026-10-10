import { DataLoadError } from "@/components/shared/data-load-error";
import { TraineeDashboard } from "@/components/steps/trainee-dashboard";
import { requireRole } from "@/lib/auth/session";
import { businessDate, selectedWeek } from "@/lib/steps/model";
import { loadDashboard } from "@/lib/steps/server";

export default async function TraineePage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string | string[];
    month?: string | string[];
  }>;
}) {
  const profile = await requireRole("trainee");
  const today = businessDate();
  const search = await searchParams;
  const week = selectedWeek(search.week, today, search.month);
  const data = await loadDashboard(profile.id, week, today);
  if (!data)
    return <DataLoadError message="לא הצלחנו לטעון את הצעדים. נסו שוב." />;
  return <TraineeDashboard name={profile.full_name} week={week} {...data} />;
}
