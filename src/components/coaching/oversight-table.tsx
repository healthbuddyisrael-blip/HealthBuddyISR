import Link from "next/link";
import { formatDate, formatSteps } from "@/lib/steps/model";
import type { OversightRow } from "@/lib/coaching/model";

export function CoachingOversightTable({
  trainees,
}: {
  trainees: OversightRow[];
}) {
  if (trainees.length === 0)
    return <p>אין מתאמנים התואמים לשבוע ולמסנן שנבחרו.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[760px] text-sm">
        <caption className="sr-only">
          עמידה בשיחות השבועיות ומקרים לתשומת לב
        </caption>
        <thead>
          <tr>
            {[
              "מתאמן",
              "מאמן אחראי",
              "שיחת השבוע",
              "שיחה אחרונה",
              "יעד נוכחי / לשבוע הבא",
              "תשומת לב",
            ].map((label) => (
              <th key={label} scope="col" className="p-3 text-start">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trainees.map((row) => (
            <tr key={row.trainee_id} className="border-t align-top">
              <th scope="row" className="p-3 text-start">
                <Link
                  href={`/admin/coaching/${row.trainee_id}`}
                  className="inline-flex min-h-10 items-center underline"
                >
                  {row.trainee_name}
                </Link>
              </th>
              <td className="p-3">{row.coach_name ?? "אין מאמן משויך"}</td>
              <td className="p-3">
                {row.call_completed
                  ? "הושלמה ותועדה"
                  : row.call_overdue
                    ? "חסרה — באיחור"
                    : "חסרה — עד סוף השבוע"}
              </td>
              <td className="p-3">
                {row.last_call_date
                  ? formatDate(row.last_call_date)
                  : "אין שיחה מתועדת"}
              </td>
              <td className="max-w-64 whitespace-pre-wrap break-words p-3">
                <p>{row.current_goal ?? "אין יעד משיחה מתועדת"}</p>
                <p className="mt-1 text-muted-foreground">
                  יעד צעדים:{" "}
                  {row.step_target === null
                    ? "—"
                    : `${formatSteps(row.step_target)}/יום`}
                </p>
              </td>
              <td className="max-w-72 space-y-1 whitespace-pre-wrap break-words p-3">
                {!row.needs_attention && "—"}
                {row.call_missing && (
                  <p>
                    {row.call_overdue
                      ? "שיחה שבועית חסרה באיחור"
                      : "שיחה שבועית ממתינה"}
                  </p>
                )}
                {row.prior_call_overdue && <p>שיחה משבוע קודם חסרה</p>}
                {row.coach_id === null && (
                  <p className="font-semibold">אין מאמן משויך</p>
                )}
                {row.missing_report_days >= 3 && (
                  <p>
                    {row.missing_report_days} ימי דיווח חסרים מתוך חלון של עד 7
                    ימים
                  </p>
                )}
                {row.attention_week && (
                  <p className="font-semibold">
                    המאמן ביקש תשומת לב ({formatDate(row.attention_week)}):{" "}
                    {row.attention_reason || "ללא סיבה נוספת"}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
