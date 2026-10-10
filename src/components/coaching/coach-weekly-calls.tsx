"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SuccessFeedback } from "@/components/shared/feedback";
import { Pagination } from "@/components/shared/pagination";
import { CallHistory } from "./call-history";
import { CheckinDialog } from "./checkin-dialog";
import type { Checkin, CoachingHistoryData } from "@/lib/coaching/model";

export function CoachWeeklyCalls({
  traineeId,
  data,
  today,
  page,
  week,
}: {
  traineeId: string;
  data: CoachingHistoryData;
  today: string;
  page: number;
  week: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ report: Checkin | null } | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const href = (p: number) =>
    `/coach/trainees/${traineeId}?${new URLSearchParams({ week, callsPage: String(p) })}`;
  return (
    <section
      className="space-y-4 rounded-2xl border border-primary/20 bg-muted p-5"
      aria-label="שיחות שבועיות"
    >
      <h2 className="text-xl font-bold">שיחה אישית שבועית</h2>
      <p className="text-sm">
        השבוע:{" "}
        {!data.current_expected
          ? "אין שיחה צפויה השבוע בתקופת התוכנית"
          : data.current?.call_completed
            ? "השיחה הושלמה ותועדה"
            : "השיחה עדיין חסרה"}
        . נדרשת שיחת טלפון אישית אחת וסיכום קצר בכל שבוע (שני–ראשון).
      </p>
      <p className="whitespace-pre-wrap break-words text-sm">
        <strong>יעד מהשיחה האחרונה: </strong>
        {data.current_goal ?? "טרם הוגדר"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => {
            setMessage("");
            setEditing({ report: data.current });
          }}
        >
          {data.current ? "עדכון השיחה השבועית" : "תיעוד שיחה שבועית"}
        </Button>
        <Button
          disabled={pending}
          variant="outline"
          onClick={() => {
            setMessage("");
            setEditing({ report: null });
          }}
        >
          תיעוד שבוע אחר
        </Button>
      </div>
      <SuccessFeedback message={message} />
      <CallHistory
        reports={data.reports}
        onEdit={(report) => {
          setMessage("");
          setEditing({ report });
        }}
      />
      <Pagination
        previous={page > 1 ? href(page - 1) : undefined}
        next={data.total > page * 25 ? href(page + 1) : undefined}
        label="עמודי היסטוריית שיחות"
      />
      {editing && (
        <CheckinDialog
          traineeId={traineeId}
          report={editing.report}
          data={data}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage("התיעוד השבועי נשמר.");
            startTransition(() => router.refresh());
          }}
        />
      )}
    </section>
  );
}
