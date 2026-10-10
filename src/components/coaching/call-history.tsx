import { formatDate } from "@/lib/steps/model";
import type { Checkin } from "@/lib/coaching/model";
import { Button } from "@/components/ui/button";

export function CallHistory({
  reports,
  onEdit,
}: {
  reports: Checkin[];
  onEdit?: (report: Checkin) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">היסטוריית שיחות שבועיות</h3>
      {reports.length === 0 && (
        <p className="text-sm text-muted-foreground">אין תיעוד שיחות עדיין.</p>
      )}
      {reports.map((report) => (
        <article
          key={report.id}
          id={`call-${report.id}`}
          className="rounded-xl border p-4"
        >
          <p className="font-semibold">
            {formatDate(report.week_start)} – {formatDate(report.week_end)}
          </p>
          {report.legacy_monday_week && (
            <p className="text-xs text-muted-foreground">
              תיעוד היסטורי לפי הגדרת השבוע הקודמת
            </p>
          )}
          <p className="text-sm">
            {report.call_completed && report.call_date
              ? `שיחה הושלמה ב-${formatDate(report.call_date)}`
              : "טיוטה — השיחה לא הושלמה"}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">
            <strong>יעד לשבוע הבא: </strong>
            {report.next_week_goal || "טרם הוגדר"}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm">
            <strong>קושי: </strong>
            {report.difficulties || "טרם תועד"}
          </p>
          {report.admin_attention_required && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold">
              נדרשת תשומת לב מנהל:{" "}
              {report.admin_attention_reason || "ללא סיבה נוספת"}
            </p>
          )}
          <details className="mt-2 text-sm">
            <summary className="min-h-10 cursor-pointer">סיכום השיחה</summary>
            <p className="whitespace-pre-wrap break-words">
              <strong>מצב כללי: </strong>
              {report.general_status || "—"}
            </p>
            <p className="whitespace-pre-wrap break-words">
              <strong>מה הוסכם: </strong>
              {report.agreements || "—"}
            </p>
          </details>
          {onEdit && (
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => onEdit(report)}
            >
              עדכון תיעוד
            </Button>
          )}
        </article>
      ))}
    </div>
  );
}
