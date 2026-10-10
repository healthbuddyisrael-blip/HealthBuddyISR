import Link from "next/link";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { historyPage } from "@/lib/coaching/model";
import { loadCoachingHistory } from "@/lib/coaching/server";
import { CallHistory } from "@/components/coaching/call-history";
import { RecentCallActivity } from "@/components/coaching/recent-activity";
import { Pagination } from "@/components/shared/pagination";
import { DataLoadError } from "@/components/shared/data-load-error";

export default async function AdminCallHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ callsPage?: string | string[] }>;
}) {
  await requireRole("admin");
  const { traineeId } = await params;
  if (!z.uuid().safeParse(traineeId).success) notFound();
  const page = historyPage((await searchParams).callsPage),
    client = await createClient();
  const [profile, history] = await Promise.all([
    client
      .from("profiles")
      .select("full_name")
      .eq("id", traineeId)
      .eq("role", "trainee")
      .maybeSingle(),
    loadCoachingHistory(traineeId, page),
  ]);
  if (profile.error || !history)
    return (
      <DataLoadError message="לא הצלחנו לטעון את היסטוריית השיחות. נסו שוב." />
    );
  if (!profile.data) notFound();
  const href = (p: number) => `/admin/coaching/${traineeId}?callsPage=${p}`;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        className="inline-flex min-h-12 items-center underline"
        href="/admin/coaching"
      >
        חזרה לפיקוח שיחות
      </Link>
      <h1 className="text-2xl font-bold">
        שיחות שבועיות — {profile.data.full_name}
      </h1>
      <p className="whitespace-pre-wrap break-words">
        <strong>יעד מהשיחה האחרונה: </strong>
        {history.current_goal ?? "טרם הוגדר"}
      </p>
      <RecentCallActivity data={history} />
      <CallHistory reports={history.reports} />
      <Pagination
        previous={page > 1 ? href(page - 1) : undefined}
        next={history.total > page * 25 ? href(page + 1) : undefined}
      />
    </div>
  );
}
