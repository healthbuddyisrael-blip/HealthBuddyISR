import Link from "next/link";
import Form from "next/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adjacentWeek, formatDate, formatSteps } from "@/lib/steps/model";
import { reportingWeek, type PilotOverview } from "@/lib/pilot/model";
export function PilotOverviewTable({
  data,
  admin,
  today,
  page = 1,
}: {
  data: PilotOverview;
  admin: boolean;
  today: string;
  page?: number;
}) {
  const path = admin ? "/admin/pilot" : "/coach/pilot";
  const labels = [
    ["participants", "משתתפים בפיילוט"],
    ["submitted", "דיווחים שהוגשו"],
    ["missing", "דיווחים חסרים או טיוטות"],
    ["conversations", "שיחות שהושלמו"],
    ["pending_conversations", "שיחות ממתינות"],
    ["overdue", "דיווחים באיחור"],
  ] as const;
  const num = (v: number | null) => (v === null ? "—" : formatSteps(v));
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">
        {admin ? "מעקב פיילוט שבועי" : "הדיווחים השבועיים שלי"}
      </h1>
      <p>
        {formatDate(data.week_start)}–{formatDate(data.week_end)} · ראשון–שבת
      </p>
      <p className="text-sm text-muted-foreground">
        הדיווח מתבצע ביום ראשון שלאחר שבוע הפעילות. איחור מתחיל לאחר סוף אותו
        יום ראשון, לפי שעון ירושלים.
      </p>
      <Form action={path} className="flex flex-wrap items-end gap-3">
        <label className="font-semibold">
          בחירת שבוע
          <Input
            type="date"
            name="reportWeek"
            defaultValue={data.week_start}
            max={reportingWeek(today)}
            required
          />
        </label>
        <Button type="submit" variant="outline">
          הצגה
        </Button>
        <Link
          href={`${path}?reportWeek=${adjacentWeek(data.week_start, -1)}`}
          className="underline"
        >
          שבוע קודם
        </Link>
        {data.week_start < reportingWeek(today) && (
          <Link
            href={`${path}?reportWeek=${adjacentWeek(data.week_start, 1)}`}
            className="underline"
          >
            שבוע הבא
          </Link>
        )}
      </Form>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {labels.map(([key, label]) => (
          <div key={key} className="rounded-xl border bg-card p-4">
            <dt className="text-sm">{label}</dt>
            <dd className="text-2xl font-bold">{data.summary[key]}</dd>
          </div>
        ))}
        <div className="rounded-xl border bg-card p-4">
          <dt>שיעור הגשה</dt>
          <dd>
            {data.summary.completion_rate === null
              ? "—"
              : `${Math.round(data.summary.completion_rate)}%`}
          </dd>
        </div>
      </dl>
      <div className="grid gap-4 md:grid-cols-2">
        {data.participants.map((p) => (
          <article
            key={p.trainee_id}
            className="space-y-2 rounded-2xl border bg-card p-5"
          >
            <h2 className="text-lg font-bold">{p.trainee_name}</h2>
            <p>מאמן: {p.coach_name ?? "לא משויך"}</p>
            <p>
              {p.status === "submitted"
                ? "הוגש"
                : p.status === "draft"
                  ? "טיוטה"
                  : "חסר"}{" "}
              · {p.call_completed ? "השיחה הושלמה" : "השיחה ממתינה"}
              {p.overdue ? " · באיחור" : ""}
            </p>
            <p>
              שיחה אחרונה:{" "}
              {p.last_call_date ? formatDate(p.last_call_date) : "—"}
            </p>
            <p>ממוצע צעדים ליום: {num(p.average_daily_steps)}</p>
            <p>
              אימוני כוח: {num(p.strength_workouts)} · אירובי:{" "}
              {num(p.aerobic_workouts)}
            </p>
            <p className="text-sm text-muted-foreground">
              {p.source === "historical_daily"
                ? "נתוני יום היסטוריים; אין דיווח שבועי שהוגש"
                : p.source
                  ? "דיווח מאמן שהוגש"
                  : ""}
            </p>
            <p className="whitespace-pre-wrap break-words">
              יעד: {p.next_week_goal || "—"}
            </p>
            <p>
              היעד הקודם:{" "}
              {p.previous_goal_met === null
                ? "לא נבדק"
                : p.previous_goal_met
                  ? "הושג לפי השיחה"
                  : "לא הושג לפי השיחה"}{" "}
              · יעדים שהושגו בארבעת הדיווחים האחרונים: {p.goals_met_recent}
            </p>
            {p.step_change !== null && (
              <p>
                שינוי בממוצע היומי לעומת השבוע הקודם:{" "}
                {p.step_change > 0 ? "+" : ""}
                {num(p.step_change)} צעדים
              </p>
            )}
            {(p.attention_required || p.difficulties) && (
              <p className="whitespace-pre-wrap break-words">
                {p.attention_required ? "נדרשת תשומת לב · " : ""}קשיים:{" "}
                {p.difficulties || "—"}
              </p>
            )}
            <Button asChild variant="outline">
              <Link
                href={
                  admin
                    ? `/admin/pilot/${p.trainee_id}?reportWeek=${data.week_start}`
                    : `/coach/trainees/${p.trainee_id}?reportWeek=${data.week_start}`
                }
              >
                {admin ? "פתיחת הדיווח" : "פתיחת טופס שבועי"}
              </Link>
            </Button>
          </article>
        ))}
      </div>
      {!data.participants.length && (
        <p>אין משתתפים משויכים לפיילוט בתקופה זו.</p>
      )}
      {admin && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-bold">מעקב מאמנים</h2>
          {data.coaches.map((c) => (
            <p key={c.coach_id}>
              {c.coach_name}: {c.submitted}/{c.participants} דיווחים שהוגשו ·{" "}
              {c.conversations}/{c.participants} שיחות הושלמו
              {c.submitted === c.participants ? " · כל הדיווחים הושלמו" : ""}
            </p>
          ))}
        </section>
      )}
      <nav className="flex gap-4" aria-label="עמודי פיילוט">
        {page > 1 && (
          <Link
            className="underline"
            href={`${path}?reportWeek=${data.week_start}&page=${page - 1}`}
          >
            הקודם
          </Link>
        )}
        {data.total > page * 25 && (
          <Link
            className="underline"
            href={`${path}?reportWeek=${data.week_start}&page=${page + 1}`}
          >
            הבא
          </Link>
        )}
      </nav>
    </section>
  );
}
