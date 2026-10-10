"use client";
import { useState } from "react";
import { WeeklyStepCalendar } from "./weekly-step-calendar";
import { DayDetailDialog } from "@/components/coach/day-detail-dialog";
import type { Day } from "@/lib/steps/model";

export function ReadOnlyStepCalendar({
  days,
  today,
  week,
  basePath,
  range,
}: {
  days: Day[];
  today: string;
  week: string;
  basePath: string;
  range: 7 | 30;
}) {
  const [selected, setSelected] = useState<Day | null>(null);
  return (
    <>
      <WeeklyStepCalendar
        days={days}
        today={today}
        week={week}
        basePath={basePath}
        range={range}
        pending={false}
        onEdit={(day) => {
          if (!day.future) setSelected(day);
        }}
      />
      {selected && (
        <DayDetailDialog day={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
