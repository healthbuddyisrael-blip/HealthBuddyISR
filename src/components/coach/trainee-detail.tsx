"use client";
import { SuccessFeedback } from "@/components/shared/feedback";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WeeklyStepCalendar } from "@/components/steps/weekly-step-calendar";
import { ProgressRing } from "@/components/steps/progress-ring";
import { formatSteps, type Day } from "@/lib/steps/model";
import type { sevenDaySummary } from "@/lib/coach/model";
import { SevenDaySummary } from "./seven-day-summary";
import { TargetDialog } from "./target-dialog";
import { DayDetailDialog } from "./day-detail-dialog";
import { ActivityProgress } from "@/components/activity/activity-progress";
import { BaselineForm } from "@/components/activity/baseline-form";
import type { ActivityData } from "@/lib/activity/model";
import { CoachWeeklyCalls } from "@/components/coaching/coach-weekly-calls";
import type { CoachingHistoryData } from "@/lib/coaching/model";

export function TraineeDetail({
  traineeId,
  name,
  week,
  today,
  days,
  summary,
  activity,
  coaching,
  callsPage,
}: {
  traineeId: string;
  name: string;
  week: string;
  today: Day;
  days: Day[];
  summary: ReturnType<typeof sevenDaySummary>;
  activity: ActivityData;
  coaching: CoachingHistoryData;
  callsPage: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Day | null>(null);
  const [changing, setChanging] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/coach"
        className="inline-flex min-h-12 items-center underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        חזרה למתאמנים שלי
      </Link>
      <h1 className="text-2xl font-bold">{name}</h1>
      <section
        aria-labelledby="current-target-heading"
        className="rounded-2xl border bg-card p-6"
      >
        <h2 id="current-target-heading" className="mb-4 text-xl font-bold">
          היום
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <dl className="space-y-2">
            <div>
              <dt className="font-semibold">יעד נוכחי:</dt>
              <dd>
                {today.target === null
                  ? "אין יעד זמין"
                  : `${formatSteps(today.target)} צעדים`}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                צעדים שדווחו היום:
              </dt>
              <dd>
                {today.steps === null ? "לא דווח" : formatSteps(today.steps)}
              </dd>
            </div>
          </dl>
          <ProgressRing
            percentage={today.percentage}
            emptyLabel={today.target === null ? "אין יעד זמין" : "לא דווח היום"}
          />
        </div>
        <Button
          variant="outline"
          className="mt-5 w-full sm:w-auto"
          disabled={pending}
          onClick={() => {
            setFeedback("");
            setChanging(true);
          }}
        >
          שינוי יעד
        </Button>
      </section>
      <SuccessFeedback message={feedback} />
      <CoachWeeklyCalls
        traineeId={traineeId}
        data={coaching}
        today={today.date}
        page={callsPage}
        week={week}
      />
      <SevenDaySummary summary={summary} />
      {!activity.progress && <BaselineForm traineeId={traineeId} />}
      <ActivityProgress activity={activity} />
      <WeeklyStepCalendar
        week={week}
        today={today.date}
        days={days}
        pending={pending}
        basePath={`/coach/trainees/${traineeId}`}
        callsPage={callsPage}
        onEdit={(day) => {
          if (!day.future) setSelected(day);
        }}
      />
      {selected && (
        <DayDetailDialog day={selected} onClose={() => setSelected(null)} />
      )}
      {changing && (
        <TargetDialog
          traineeId={traineeId}
          target={today.target}
          onClose={() => setChanging(false)}
          onSaved={() => {
            setChanging(false);
            setFeedback("היעד עודכן.");
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}
