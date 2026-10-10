import test from "node:test";
import assert from "node:assert/strict";
import {
  activityChange,
  baselineInputSchema,
  type ActivityData,
} from "../src/lib/activity/model.ts";
import { calendarDays, saveStepsSchema } from "../src/lib/steps/model.ts";
import "./tsx-loader.mts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const { WorkoutInputs } =
  await import("../src/components/activity/workout-inputs.tsx");
const { ActivityProgress } =
  await import("../src/components/activity/activity-progress.tsx");

for (const [strength, cardio] of [
  [1, 0],
  [0, 0],
  [3, 0],
  [1, 2],
]) {
  test(`shared participant/coach/admin progress renders strength ${strength}, aerobic ${cardio}`, () => {
    const activity: ActivityData = {
      progress: null,
      weeks: [
        {
          week_start: "2026-09-27",
          average_daily_steps: 6000,
          step_days: 7,
          strength_days: 7,
          cardio_days: 7,
          strength_sessions: strength!,
          cardio_sessions: cardio!,
        },
      ],
    };
    const markup = renderToStaticMarkup(
      createElement(ActivityProgress, { activity }),
    );
    assert.match(
      markup,
      new RegExp(`<td class="p-2">${strength} \\(7/7\\)</td>`),
    );
    assert.match(
      markup,
      new RegExp(`<td class="p-2">${cardio} \\(7/7\\)</td>`),
    );
    assert.match(markup, /ראשון–שבת/);
  });
}

test("first-day progress displays one recorded workout and suppresses the old projected seven", () => {
  const markup = renderToStaticMarkup(
    createElement(ActivityProgress, {
      activity: {
        weeks: [],
        progress: {
          baseline: {
            baseline_average_daily_steps: 3000,
            baseline_strength_sessions_per_week: 1,
            baseline_cardio_sessions_per_week: 2,
            baseline_period_start: "2026-09-27",
            baseline_period_end: "2026-10-03",
            program_start: "2026-10-04",
            program_end: "2026-10-17",
            steps_source: "manual",
          },
          window_start: "2026-10-04",
          window_end: "2026-10-04",
          completed: false,
          current: {
            average_daily_steps: 6000,
            step_days: 1,
            strength_days: 1,
            cardio_days: 1,
            strength_sessions: 1,
            cardio_sessions: 1,
            // Existing database response during an application-first rollout.
            strength_sessions_per_week: 7,
            cardio_sessions_per_week: 7,
          },
        },
      },
    }),
  );
  assert.match(markup, /אימוני כוח: 1/);
  assert.match(markup, /אימוני אירובי: 1/);
  assert.doesNotMatch(markup, /<td[^>]*>7<\/td>|\+6|\+5/);
  assert.match(markup, /6,000/);
});

test("baseline accepts nonzero interview values and manual or historical steps", () => {
  const base = {
    traineeId: "90000000-0000-4000-8000-000000000004",
    programStart: "2026-09-01",
    programEnd: "2026-09-30",
    manualSteps: 3000,
    strength: 2,
    cardio: 1.5,
  };
  assert.ok(baselineInputSchema.safeParse(base).success);
  assert.ok(
    baselineInputSchema.safeParse({ ...base, manualSteps: null }).success,
  );
  for (const change of [
    { strength: -1 },
    { cardio: 8 },
    { programEnd: "2026-09-13" },
    { manualSteps: -1 },
    { programStart: "2026-02-30" },
    { traineeId: "other" },
  ])
    assert.equal(
      baselineInputSchema.safeParse({ ...base, ...change }).success,
      false,
    );
});
for (const [strength, cardio] of [
  [false, false],
  [true, false],
  [false, true],
  [true, true],
  [null, null],
] as const) {
  test(`daily report strength=${strength} cardio=${cardio}`, () => {
    const input = {
      kind: "today",
      steps: 7250,
      strength_workout_completed: strength,
      cardio_workout_completed: cardio,
    };
    assert.deepEqual(saveStepsSchema.parse(input), input);
    const markup = renderToStaticMarkup(
      createElement(WorkoutInputs, {
        strength,
        cardio,
        onStrength: () => {},
        onCardio: () => {},
        disabled: false,
        historicalUnknown: strength === null,
      }),
    );
    assert.equal((markup.match(/type="checkbox"/g) ?? []).length, 2);
    assert.equal(
      (markup.match(/checked=""/g) ?? []).length,
      Number(strength === true) + Number(cardio === true),
    );
    assert.doesNotMatch(markup, /required=/);
  });
}
test("calendar preserves missing, false, true and historical unknown workout flags", () => {
  const days = calendarDays(
    "2026-10",
    "2026-10-04",
    [
      { date: "2026-10-01", steps: 0 },
      {
        date: "2026-10-02",
        steps: 5900,
        strength_workout_completed: true,
        cardio_workout_completed: false,
      },
    ],
    [],
  );
  assert.equal(days[0]!.steps, 0);
  assert.equal(days[0]!.strength_workout_completed, null);
  assert.equal(days[1]!.strength_workout_completed, true);
  assert.equal(days[1]!.cardio_workout_completed, false);
  assert.equal(days[2]!.steps, null);
  assert.equal(days[2]!.cardio_workout_completed, null);
});
test("baseline comparisons preserve fractional frequencies, missing data and zero percentage edge", () => {
  assert.deepEqual(activityChange(3000, 7000), {
    absolute: 4000,
    percentage: (4000 * 100) / 3000,
  });
  assert.deepEqual(activityChange(0, 1), { absolute: 1, percentage: null });
  assert.deepEqual(activityChange(1, 1.5), { absolute: 0.5, percentage: 50 });
  assert.deepEqual(activityChange(3000, null), {
    absolute: null,
    percentage: null,
  });
});
test("progress shows baseline, final window, coverage, signed changes and weekly counts", () => {
  const markup = renderToStaticMarkup(
    createElement(ActivityProgress, {
      activity: {
        progress: {
          baseline: {
            baseline_average_daily_steps: 3000,
            baseline_strength_sessions_per_week: 0,
            baseline_cardio_sessions_per_week: 0,
            baseline_period_start: "2026-08-25",
            baseline_period_end: "2026-08-31",
            program_start: "2026-09-01",
            program_end: "2026-09-30",
            steps_source: "historical",
          },
          window_start: "2026-09-17",
          window_end: "2026-09-30",
          completed: true,
          current: {
            average_daily_steps: 7000,
            step_days: 14,
            strength_days: 14,
            cardio_days: 14,
            strength_sessions: 2,
            cardio_sessions: 3,
            strength_sessions_per_week: 1,
            cardio_sessions_per_week: 1.5,
          },
        },
        weeks: [
          {
            week_start: "2026-09-21",
            average_daily_steps: 7000,
            step_days: 7,
            strength_days: 7,
            cardio_days: 7,
            strength_sessions: 1,
            cardio_sessions: 2,
          },
        ],
      },
    }),
  );
  assert.match(markup, /3,000/);
  assert.match(markup, /7,000/);
  assert.match(markup, /\+4,000/);
  assert.match(markup, /14\/14/);
  assert.match(markup, /1\.5/);
  assert.doesNotMatch(markup, /Infinity|NaN|%/);
});
