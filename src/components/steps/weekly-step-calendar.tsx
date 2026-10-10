"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import {
  adjacentWeek,
  formatDate,
  formatSteps,
  weekBounds,
  weekStart,
  weeklyCalendarDays,
  type Day,
} from "@/lib/steps/model";
import { ProgressRing } from "./progress-ring";

export function CalendarDay({
  day,
  today,
  onEdit,
  loading = false,
}: {
  day: Day;
  today: string;
  onEdit: (day: Day) => void;
  loading?: boolean;
}) {
  const state = day.future
    ? "תאריך עתידי"
    : day.steps === null
      ? "לא דווח"
      : `${formatSteps(day.steps)} צעדים`;
  return (
    <button
      type="button"
      disabled={day.future || loading}
      aria-busy={loading}
      onClick={() => onEdit(day)}
      aria-label={`${formatDate(day.date)}, ${state}, ${day.target === null ? "אין יעד" : `יעד ${formatSteps(day.target)} צעדים`}${day.percentage === null ? "" : `, ${day.percentage}% מהיעד`}`}
      aria-current={day.date === today ? "date" : undefined}
      className={`@container aspect-square w-full min-w-0 rounded-xl border p-0 ${day.steps !== null ? "border-primary/25 bg-accent/60" : "border-border bg-card"} aria-[current=date]:border-primary aria-[current=date]:bg-accent hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-40`}
    >
      <div className="flex size-full flex-col items-center justify-center gap-0 p-0.5 @min-[4rem]:gap-0.5">
        <span className="text-[clamp(10px,18cqw,14px)] leading-4 font-semibold">
          {Number(day.date.slice(8))}
        </span>
        {loading ? (
          <LoaderCircle
            aria-label="טוענים דיווח יומי"
            className="size-3 animate-spin text-primary motion-reduce:animate-none @min-[4rem]:size-6"
          />
        ) : (
          !day.future && (
            <>
              <div className="hidden size-6 @min-[4rem]:block @min-[5rem]:size-8 [&>div]:w-full">
                <ProgressRing
                  compact
                  percentage={day.percentage}
                  emptyLabel={day.target === null ? "אין יעד" : "לא דווח"}
                />
              </div>
              <span className="max-w-full truncate text-[clamp(8px,14cqw,12px)] leading-3 text-muted-foreground">
                {day.target === null ? (
                  "אין יעד"
                ) : day.steps === null ? (
                  "לא דווח"
                ) : (
                  <span>{formatSteps(day.steps)}</span>
                )}
              </span>
            </>
          )
        )}
      </div>
    </button>
  );
}
export function WeeklyStepCalendar({
  week,
  today,
  days,
  onEdit,
  pending,
  basePath = "/app",
  range,
  callsPage,
}: {
  week: string;
  today: string;
  days: Day[];
  onEdit: (day: Day) => void;
  pending: boolean;
  basePath?: string;
  range?: 7 | 30;
  callsPage?: number;
}) {
  const router = useRouter();
  const [displayedWeek, setDisplayedWeek] = useOptimistic(week);
  const [navigating, startNavigation] = useTransition();
  const loading = navigating || displayedWeek !== week;
  const displayedDays = loading
    ? weeklyCalendarDays(displayedWeek, today, [], [])
    : days;
  const previous = adjacentWeek(displayedWeek, -1),
    next = adjacentWeek(displayedWeek, 1);
  const bounds = weekBounds(displayedWeek);
  const href = (date: string) =>
    `${basePath}?${new URLSearchParams({ week: date, ...(range ? { range: String(range) } : {}), ...(callsPage && callsPage > 1 ? { callsPage: String(callsPage) } : {}) })}`;
  const navigationClass =
    "flex size-12 shrink-0 items-center justify-center rounded-xl border focus-visible:outline-2 focus-visible:outline-ring hover:bg-muted";
  const navigate = (
    event: React.MouseEvent<HTMLAnchorElement>,
    date: string,
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (loading) return;
    startNavigation(() => {
      setDisplayedWeek(date);
      router.push(href(date), { scroll: false });
    });
  };
  return (
    <section
      aria-labelledby="calendar-title"
      aria-busy={pending || loading}
      className="rounded-2xl border border-primary/20 bg-muted p-2 shadow-sm sm:p-6"
    >
      <div className="mb-5 flex items-center justify-between gap-2 px-2">
        {previous ? (
          <Link
            href={href(previous)}
            onClick={(event) => navigate(event, previous)}
            aria-disabled={loading}
            scroll={false}
            className={navigationClass}
            aria-label="השבוע הקודם"
          >
            →
          </Link>
        ) : (
          <span className="size-12" />
        )}
        <h2
          id="calendar-title"
          className="min-w-0 text-center text-base font-bold sm:text-lg"
        >
          <span className="block text-sm text-primary">הפעילות השבועית</span>
          {formatDate(bounds.start)} – {formatDate(bounds.end)}
          <span
            role="status"
            className="block min-h-5 text-xs font-normal text-muted-foreground"
          >
            {loading ? "טוענים את ימי השבוע…" : "ראשון–שבת"}
          </span>
        </h2>
        {next && next <= weekStart(today) ? (
          <Link
            href={href(next)}
            onClick={(event) => navigate(event, next)}
            aria-disabled={loading}
            scroll={false}
            className={navigationClass}
            aria-label="השבוע הבא"
          >
            ←
          </Link>
        ) : (
          <button
            disabled
            className={`${navigationClass} opacity-30`}
            aria-label="השבוע הבא"
          >
            ←
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
        {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((label, index) => (
          <span
            key={label}
            className="pb-2 text-center text-sm text-muted-foreground"
            aria-label={
              [
                "יום ראשון",
                "יום שני",
                "יום שלישי",
                "יום רביעי",
                "יום חמישי",
                "יום שישי",
                "שבת",
              ][index]
            }
          >
            {label}
          </span>
        ))}
        {displayedDays.map((day) => (
          <CalendarDay
            key={day.date}
            day={day}
            today={today}
            onEdit={onEdit}
            loading={loading}
          />
        ))}
      </div>
    </section>
  );
}
