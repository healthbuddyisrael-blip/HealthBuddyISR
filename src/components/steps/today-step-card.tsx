import { Button } from "@/components/ui/button";
import { formatSteps, type Day } from "@/lib/steps/model";
import { ProgressRing } from "./progress-ring";

export function TodayStepCard({
  day,
  onEdit,
}: {
  day: Day;
  onEdit: () => void;
}) {
  return (
    <section
      aria-labelledby="today-title"
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-accent via-muted to-card p-5 shadow-sm sm:p-8"
    >
      <h2 id="today-title" className="mb-4 text-xl font-bold">
        היום
      </h2>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-6">
        <div className="space-y-2">
          {day.steps === null ? (
            <p className="text-lg font-semibold">עדיין לא הוזנו צעדים</p>
          ) : (
            <p className="break-all text-3xl font-bold tabular-nums sm:text-4xl">
              <bdi dir="ltr">{formatSteps(day.steps)}</bdi>
            </p>
          )}
          {day.target === null ? (
            <p role="alert" className="max-w-xs text-destructive">
              לא הצלחנו להציג את היעד היומי. נסו שוב מאוחר יותר.
            </p>
          ) : (
            <p className="text-muted-foreground">
              {day.steps === null ? "היעד שלך:" : "מתוך"}{" "}
              <bdi dir="ltr">{formatSteps(day.target)}</bdi> צעדים
            </p>
          )}
        </div>
        <ProgressRing
          percentage={day.percentage}
          emptyLabel={
            day.target === null ? "אין יעד זמין" : "עדיין לא הוזנו צעדים"
          }
        />
      </div>
      <Button onClick={onEdit} size="lg" className="mt-6 w-full">
        {day.steps === null ? "הזנת צעדים" : "עדכון צעדים"}
      </Button>
    </section>
  );
}
