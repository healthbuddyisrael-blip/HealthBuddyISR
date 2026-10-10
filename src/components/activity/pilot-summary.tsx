import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const count = z.number().int().nonnegative();
const nullable = z.number().nullable();
const schema = z.object({
  participants: count,
  baselines: count,
  completed: count,
  step_eligible: count,
  strength_eligible: count,
  cardio_eligible: count,
  all_eligible: count,
  baseline_steps_average: nullable,
  baseline_steps_median: nullable,
  final_steps_average: nullable,
  final_steps_median: nullable,
  step_change_average: nullable,
  step_change_median: nullable,
  steps_improved_percentage: nullable,
  strength_improved_percentage: nullable,
  cardio_improved_percentage: nullable,
  two_dimensions_improved_percentage: nullable,
});
export async function PilotSummary() {
  await requireRole("admin");
  const client = await createClient();
  const { data, error } = await client.rpc("get_pilot_activity_summary");
  const parsed = schema.safeParse(data);
  if (error || !parsed.success)
    return <p role="alert">סיכום פעילות הפיילוט אינו זמין כרגע.</p>;
  const s = parsed.data;
  const format = (v: number | null) =>
    v === null
      ? "—"
      : new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 }).format(v);
  const metrics = [
    [
      "צעדי פתיחה: ממוצע / חציון",
      `${format(s.baseline_steps_average)} / ${format(s.baseline_steps_median)}`,
    ],
    [
      "צעדי סיום: ממוצע / חציון",
      `${format(s.final_steps_average)} / ${format(s.final_steps_median)}`,
    ],
    [
      "שינוי צעדים: ממוצע / חציון",
      `${format(s.step_change_average)} / ${format(s.step_change_median)}`,
    ],
    [
      `עלייה בצעדים (${s.step_eligible} משתתפים)`,
      s.steps_improved_percentage === null
        ? "—"
        : `${format(s.steps_improved_percentage)}%`,
    ],
    [
      `עלייה בכוח (${s.strength_eligible} משתתפים)`,
      s.strength_improved_percentage === null
        ? "—"
        : `${format(s.strength_improved_percentage)}%`,
    ],
    [
      `עלייה באירובי (${s.cardio_eligible} משתתפים)`,
      s.cardio_improved_percentage === null
        ? "—"
        : `${format(s.cardio_improved_percentage)}%`,
    ],
    [
      `שיפור בשני מדדים לפחות (${s.all_eligible} משתתפים)`,
      s.two_dimensions_improved_percentage === null
        ? "—"
        : `${format(s.two_dimensions_improved_percentage)}%`,
    ],
  ];
  return (
    <section
      className="space-y-3 rounded-2xl border bg-card p-5"
      aria-label="פעילות פיילוט"
    >
      <h2 className="text-xl font-bold">פעילות הפיילוט — תוצאות סיום</h2>
      <p>
        {s.participants} משתתפים · {s.baselines} נתוני פתיחה · {s.completed}{" "}
        תוכניות הסתיימו
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-semibold" dir="ltr">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        סיכום כלל הפיילוט, ללא קשר למסנני הדף. כל מדד כולל רק משתתפים עם 14
        דיווחי סיום ידועים עבורו. ממוצעי וחציוני הצעדים משווים את אותה קבוצת
        משתתפים; מדד שני השיפורים דורש כיסוי מלא בכל שלושת המדדים.
      </p>
    </section>
  );
}
