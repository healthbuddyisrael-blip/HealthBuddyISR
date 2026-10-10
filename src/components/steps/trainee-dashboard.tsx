"use client";
import { SuccessFeedback } from "@/components/shared/feedback";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Day } from "@/lib/steps/model";
import { TodayStepCard } from "./today-step-card";
import { WeeklyStepCalendar } from "./weekly-step-calendar";
import { StepEntryDialog } from "./step-entry-dialog";
import { ActivityProgress } from "@/components/activity/activity-progress";
import type { ActivityData } from "@/lib/activity/model";

export function TraineeDashboard({
  name,
  today,
  week,
  days,
  activity,
}: {
  name: string;
  today: Day;
  week: string;
  days: Day[];
  activity: ActivityData;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{
    day: Day;
    isToday: boolean;
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">שלום, {name}</h1>
      <TodayStepCard
        day={today}
        onEdit={() => {
          setFeedback("");
          setSelected({ day: today, isToday: true });
        }}
      />
      <SuccessFeedback message={feedback} />
      <ActivityProgress activity={activity} />
      <WeeklyStepCalendar
        week={week}
        today={today.date}
        days={days}
        pending={pending}
        onEdit={(day) => {
          if (!day.future) {
            setFeedback("");
            setSelected({ day, isToday: false });
          }
        }}
      />
      {selected && (
        <StepEntryDialog
          key={selected.day.date}
          {...selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setFeedback("הצעדים נשמרו.");
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}
