"use client";
/* eslint-disable @next/next/no-img-element -- Private signed images and local blob previews must not be cached by the image optimizer. */
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatSteps, weekBounds } from "@/lib/steps/model";
import {
  reportOverdue,
  reportingWeek,
  screenshotLimit,
  type PilotDetail,
} from "@/lib/pilot/model";
const notes = [
  ["general_feeling", "הרגשה כללית"],
  ["difficulties", "קשיים וחסמים (אם אין, כתבו שאין)"],
  ["progress", "התקדמות ודברים חיוביים"],
  ["agreements", "הסכמות ופעולות"],
  ["next_week_goal", "יעד אישי לשבוע הבא"],
] as const;
const value = (v: number | null) => (v === null ? "—" : formatSteps(v));
export function ReportWorkspace({
  data,
  basePath,
  participant = false,
}: {
  data: PilotDetail;
  basePath: string;
  participant?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [conversation, setConversation] = useState(
    data.report?.call_completed ?? false,
  );
  const report = data.report;
  const end = weekBounds(data.week).end;
  const eligible =
    data.week >= data.startsOn && (!data.endsOn || data.week <= data.endsOn);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  return (
    <section
      className="mx-auto max-w-3xl space-y-5"
      aria-label="דיווח שבועי בפיילוט"
    >
      <h1 className="text-2xl font-bold">{data.name} — מעקב שבועי</h1>
      <p>
        שבוע הפעילות: {formatDate(data.week)}–{formatDate(end)} (ראשון–שבת)
      </p>
      <p className="text-sm text-muted-foreground">
        המאמן אוסף ומזין את הנתונים בשיחת יום ראשון, לאחר סיום שבוע הפעילות. אין
        צורך בדיווח עצמאי של המשתתף.
      </p>
      <form action={basePath} className="flex flex-wrap items-end gap-3">
        <label className="font-semibold">
          בחירת שבוע שהסתיים
          <Input
            type="date"
            name="reportWeek"
            defaultValue={data.week}
            max={reportingWeek(data.today)}
            required
          />
        </label>
        <Button type="submit" variant="outline">
          הצגת השבוע
        </Button>
      </form>
      <p className="rounded-xl bg-muted p-3">
        מצב:{" "}
        {!eligible
          ? "מחוץ לתקופת הפיילוט"
          : report?.status === "submitted"
            ? "הוגש"
            : report
              ? "טיוטה"
              : "טרם דווח"}{" "}
        · שיחה: {report?.call_completed ? "הושלמה" : "טרם הושלמה"}
        {eligible &&
        reportOverdue(data.week, data.today) &&
        report?.status !== "submitted"
          ? " · באיחור"
          : ""}
      </p>
      {participant && (
        <p className="rounded-xl border p-4">
          הנתונים מנוהלים על ידי המאמן. אפשר לצפות כאן בסיכומים שהוגשו ובנתוני
          עבר.
        </p>
      )}
      {!data.readOnly && eligible ? (
        <form
          key={`${data.week}:${report?.revision ?? 0}`}
          noValidate
          className="space-y-5 rounded-2xl border bg-card p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const status =
              (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "value",
              ) ?? "draft";
            const numeric = (key: string) =>
              form.get(key) === "" ? null : Number(form.get(key));
            form.set(
              "report",
              JSON.stringify({
                trainee_id: data.traineeId,
                week_start: data.week,
                status,
                revision: report?.revision ?? null,
                average_daily_steps: numeric("average_daily_steps"),
                strength_workouts: numeric("strength_workouts"),
                aerobic_workouts: numeric("aerobic_workouts"),
                call_completed: conversation,
                call_date: conversation
                  ? String(form.get("call_date") || "") || null
                  : null,
                ...Object.fromEntries(
                  notes.map(([key]) => [key, String(form.get(key) || "")]),
                ),
                attention_required: form.get("attention_required") === "on",
                previous_goal_met:
                  form.get("previous_goal_met") === ""
                    ? null
                    : form.get("previous_goal_met") === "true",
              }),
            );
            form.set(
              "evidenceConfirmed",
              form.get("evidenceConfirmed") === "on" ? "true" : "false",
            );
            setMessage("");
            startTransition(async () => {
              try {
                const { savePilotReport } = await import("@/app/pilot/actions");
                const result = await savePilotReport(form);
                setFailed(!result.ok);
                setMessage(result.message);
                if (result.ok) {
                  setFile(null);
                  setPreview(null);
                  router.refresh();
                }
              } catch {
                setFailed(true);
                setMessage("השמירה נכשלה. הנתונים נשארו בטופס; נסו שוב.");
              }
            });
          }}
        >
          <fieldset disabled={pending} className="space-y-4">
            <legend className="text-lg font-bold">פעילות גופנית</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["average_daily_steps", "ממוצע צעדים ליום", 0.01],
                ["strength_workouts", "מספר אימוני כוח", 1],
                ["aerobic_workouts", "מספר אימוני אירובי", 1],
              ].map(([key, label, step]) => (
                <label key={key} className="text-sm font-semibold">
                  {label}
                  <Input
                    name={String(key)}
                    type="number"
                    min="0"
                    max="2147483647"
                    step={step}
                    inputMode={step === 1 ? "numeric" : "decimal"}
                    defaultValue={report?.[key as "average_daily_steps"] ?? ""}
                  />
                </label>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              ממוצע יומי לכל שבעת הימים; אימונים הם מספר מפגשים בפועל. אפס הוא
              נתון תקין.
            </p>
            <label className="block font-semibold">
              תמונת צעדים לשבוע הנבחר
              <Input
                type="file"
                name="screenshot"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  if (
                    selected &&
                    (selected.size > screenshotLimit ||
                      !["image/png", "image/jpeg", "image/webp"].includes(
                        selected.type,
                      ))
                  ) {
                    setFailed(true);
                    setMessage("בחרו PNG, JPEG או WebP עד 3MB.");
                    e.target.value = "";
                    setFile(null);
                    return;
                  }
                  setFile(selected);
                  setPreview(selected ? URL.createObjectURL(selected) : null);
                }}
              />
            </label>
            <p className="text-sm">
              {report?.screenshot_path
                ? "קיימת תמונה. בחירת תמונה חדשה תחליף אותה לאחר שמירה מוצלחת."
                : "לא הועלתה תמונה; ניתן לשמור טיוטה, אך לא להגיש."}
            </p>
            {file && (
              <label className="flex items-center gap-3">
                <input type="checkbox" name="evidenceConfirmed" />
                התמונה מציגה את הטווח {formatDate(data.week)}–{formatDate(end)}
              </label>
            )}
            {(preview || data.screenshotUrl) && (
              <img
                src={preview ?? data.screenshotUrl!}
                alt="תצוגה מקדימה של תמונת הצעדים לשבוע הדיווח"
                className="max-h-96 w-full rounded-xl object-contain"
              />
            )}
          </fieldset>
          <fieldset disabled={pending} className="space-y-4">
            <legend className="text-lg font-bold">שיחה ומעקב אישי</legend>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={conversation}
                onChange={(e) => setConversation(e.target.checked)}
              />
              השיחה הושלמה
            </label>
            {conversation && (
              <label className="block font-semibold">
                תאריך השיחה
                <Input
                  name="call_date"
                  type="date"
                  min={new Date(
                    new Date(`${end}T12:00:00Z`).getTime() + 86400000,
                  )
                    .toISOString()
                    .slice(0, 10)}
                  max={data.today}
                  defaultValue={report?.call_date ?? data.today}
                />
              </label>
            )}
            {notes.map(([key, label]) => (
              <label key={key} className="block font-semibold">
                {label}
                <textarea
                  name={key}
                  maxLength={500}
                  rows={3}
                  defaultValue={report?.[key] ?? ""}
                  className="mt-2 w-full rounded-xl border border-input bg-background p-3 font-normal focus-visible:outline-2 focus-visible:outline-ring"
                />
              </label>
            ))}
            <label className="block font-semibold">
              האם היעד מהשבוע הקודם הושג? (לפי השיחה)
              <select
                name="previous_goal_met"
                defaultValue={
                  report?.previous_goal_met === null ||
                  report?.previous_goal_met === undefined
                    ? ""
                    : String(report.previous_goal_met)
                }
                className="mt-2 min-h-12 w-full rounded-xl border bg-background p-3"
              >
                <option value="">לא נבדק / לא היה יעד קודם</option>
                <option value="true">כן</option>
                <option value="false">לא</option>
              </select>
            </label>
            <label className="flex items-center gap-3">
              <input
                name="attention_required"
                type="checkbox"
                defaultChecked={report?.attention_required}
              />
              נדרשת תשומת לב מנהל
            </label>
          </fieldset>
          <p className="text-sm">
            שיחה שהושלמה יכולה להישאר בטיוטה. להגשה דרושים נתוני פעילות, תמונה
            וכל שדות המעקב.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={pending}
              type="submit"
              value="draft"
              variant="outline"
            >
              {report?.status === "submitted" ? "החזרה לטיוטה" : "שמירת טיוטה"}
            </Button>
            <Button disabled={pending} type="submit" value="submitted">
              {pending
                ? "שומר…"
                : report?.status === "submitted"
                  ? "שמירת תיקון והגשה"
                  : "הגשת דיווח"}
            </Button>
          </div>
        </form>
      ) : !eligible && !data.readOnly ? (
        <p>השבוע מחוץ לתקופת הפיילוט שהוגדרה. נתוני העבר נשמרים לקריאה.</p>
      ) : (
        report && (
          <section className="space-y-3 rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-bold">הדיווח לשבוע</h2>
            <p>
              ממוצע צעדים ליום: {value(report.average_daily_steps)} · כוח:{" "}
              {value(report.strength_workouts)} · אירובי:{" "}
              {value(report.aerobic_workouts)}
            </p>
            {notes.map(([key, label]) => (
              <p key={key} className="whitespace-pre-wrap break-words">
                <strong>{label}: </strong>
                {report[key] || "—"}
              </p>
            ))}
            {data.screenshotUrl && (
              <a
                href={data.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={data.screenshotUrl}
                  alt="תמונת צעדים לשבוע הנבחר"
                  className="max-h-96 w-full rounded-xl object-contain"
                />
              </a>
            )}
            {!participant && report.screenshot_path && (
              <Button
                type="button"
                variant="outline"
                onClick={() => router.refresh()}
              >
                רענון קישור זמני לתמונה
              </Button>
            )}
          </section>
        )
      )}
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "text-destructive" : "text-primary"}
        >
          {message}
        </p>
      )}
      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-bold">נתוני פעילות לאורך זמן</h2>
        <p className="text-sm text-muted-foreground">
          דיווח שבועי שהוגש מחליף את סיכום הדיווחים היומיים לאותו שבוע. המספרים
          אינם מחוברים. שינוי בפעילות אינו מסקנה רפואית.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr>
                {["שבוע", "ממוצע צעדים ליום", "כוח", "אירובי", "מקור"].map(
                  (x) => (
                    <th key={x} className="p-2 text-start">
                      {x}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.figures.map((f, i) => (
                <tr key={f.week_start} className="border-t">
                  <td className="p-2">{formatDate(f.week_start)}</td>
                  <td className="p-2">
                    {value(f.average_daily_steps)}
                    {f.average_daily_steps !== null &&
                      data.figures[i + 1]?.average_daily_steps != null && (
                        <span aria-label="שינוי לעומת השבוע הקודם">
                          {" "}
                          (
                          {f.average_daily_steps -
                            data.figures[i + 1]!.average_daily_steps! >=
                          0
                            ? "+"
                            : ""}
                          {value(
                            f.average_daily_steps -
                              data.figures[i + 1]!.average_daily_steps!,
                          )}
                          )
                        </span>
                      )}
                  </td>
                  <td className="p-2">{value(f.strength_workouts)}</td>
                  <td className="p-2">{value(f.aerobic_workouts)}</td>
                  <td className="p-2">
                    {f.source === "manual_coach"
                      ? "דיווח מאמן"
                      : "נתוני יום היסטוריים"}
                    {f.source === "historical_daily"
                      ? ` (${f.step_days}/7 ימים)`
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.figures.length === 0 && (
          <p>אין עדיין נתוני פעילות לשבועות אלו.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">דיווחים קודמים ויעדים</h2>
        {data.reports.map((r) => (
          <article key={r.id} className="rounded-xl border bg-card p-4">
            <Link
              className="underline"
              href={`${basePath}?reportWeek=${r.week_start}`}
            >
              {formatDate(r.week_start)}–{formatDate(r.week_end)} ·{" "}
              {r.status === "submitted" ? "הוגש" : "טיוטה"}
            </Link>
            <p className="whitespace-pre-wrap break-words">
              התקדמות: {r.progress || "—"}
            </p>
            <p className="whitespace-pre-wrap break-words">
              יעד: {r.next_week_goal || "—"}
            </p>
          </article>
        ))}
        <div className="flex gap-4">
          {data.page > 1 && (
            <Link
              className="underline"
              href={`${basePath}?reportWeek=${data.week}&reportPage=${data.page - 1}`}
            >
              דיווחים חדשים יותר
            </Link>
          )}
          {data.total > data.page * 12 && (
            <Link
              className="underline"
              href={`${basePath}?reportWeek=${data.week}&reportPage=${data.page + 1}`}
            >
              דיווחים ישנים יותר
            </Link>
          )}
        </div>
      </section>
    </section>
  );
}
