import Link from "next/link";
import { loadCoachingHistory } from "@/lib/coaching/server";
import { CallHistory } from "./call-history";

export default async function TraineeCallHistory({
  traineeId,
}: {
  traineeId: string;
}) {
  const data = await loadCoachingHistory(traineeId);
  return (
    <section
      className="space-y-3 rounded-2xl border bg-card p-5"
      aria-label="היסטוריית שיחות"
    >
      <h2 className="text-xl font-bold">שיחות שבועיות</h2>
      {data ? (
        <>
          <p className="whitespace-pre-wrap break-words">
            <strong>יעד מהשיחה האחרונה: </strong>
            {data.current_goal ?? "טרם הוגדר"}
          </p>
          <CallHistory reports={data.reports} />
        </>
      ) : (
        <p role="alert">היסטוריית השיחות אינה זמינה כרגע.</p>
      )}
      <Link
        className="inline-flex min-h-12 items-center underline"
        href={`/admin/coaching/${traineeId}`}
      >
        כל היסטוריית השיחות
      </Link>
    </section>
  );
}
