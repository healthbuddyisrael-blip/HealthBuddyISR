import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./tsx-loader.mts";
import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
const { ProgressRing } =
  await import("../src/components/steps/progress-ring.tsx");
const { TodayStepCard } =
  await import("../src/components/steps/today-step-card.tsx");
const { RoleNavigation } =
  await import("../src/components/layout/role-navigation.tsx");
const { Pagination } = await import("../src/components/shared/pagination.tsx");
const { EmptyState, SuccessFeedback } =
  await import("../src/components/shared/feedback.tsx");
const { AuthForm } = await import("../src/components/shared/auth-form.tsx");
const { RecordNotFound } =
  await import("../src/components/shared/record-not-found.tsx");

test("accessible progress announces actual values while visual fill stays capped", () => {
  for (const percentage of [0, 74, 100, 110, 250, 1000, 214748364700]) {
    const markup = render(h(ProgressRing, { percentage, compact: true }));
    assert.match(markup, new RegExp(`aria-label="${percentage}% מהיעד היומי"`));
    assert.match(
      markup,
      new RegExp(`stroke-dasharray="${Math.min(percentage, 100)} 100"`),
    );
  }
  const missing = render(h(ProgressRing, { percentage: null }));
  assert.match(missing, /aria-label="לא דווח"/);
  assert.doesNotMatch(missing, />0%/);
});
test("today card distinguishes missing from zero and exposes the correct primary action", () => {
  for (const steps of [null, 0, 2147483647]) {
    const markup = render(
      h(TodayStepCard, {
        day: {
          date: "2026-10-02",
          steps,
          target: 10000,
          percentage: steps === null ? null : Math.round(steps / 100),
          future: false,
        },
        onEdit: () => {},
      }),
    );
    assert.match(markup, steps === null ? /הזנת צעדים/ : /עדכון צעדים/);
    if (steps === null) assert.doesNotMatch(markup, />0%/);
    else assert.match(markup, /<bdi dir="ltr">/);
  }
});
test("role navigation contains only the existing destinations for the supplied role", () => {
  const trainee = render(h(RoleNavigation, { role: "trainee" }));
  assert.match(trainee, /href="\/app"/);
  assert.doesNotMatch(trainee, /\/coach|\/admin|הזמנות/);
  const coach = render(h(RoleNavigation, { role: "coach" }));
  assert.match(coach, /המתאמנים שלי/);
  assert.match(coach, /href="\/coach\/invitations"/);
  assert.doesNotMatch(coach, /\/admin/);
  const admin = render(h(RoleNavigation, { role: "admin" }));
  assert.match(admin, /סקירה|הזמנות מאמנים/);
  assert.doesNotMatch(admin, /href="\/coach/);
});
test("pagination has Hebrew accessible controls and omits unavailable destinations", () => {
  const markup = render(
    h(Pagination, { next: "/admin?page=2", label: "עמודי מאמנים" }),
  );
  assert.match(markup, /aria-label="עמודי מאמנים"/);
  assert.match(markup, />הבא/);
  assert.doesNotMatch(markup, /הקודם/);
  assert.equal(render(h(Pagination, {})), "");
});
test("nested empty states preserve heading hierarchy and success feedback stays a live region", () => {
  const markup = render(
    h(EmptyState, {
      title: "עדיין אין הזמנות",
      description: "אפשר לשלוח הזמנה בטופס למעלה.",
      headingLevel: 3,
    }),
  );
  assert.match(markup, /<h3/);
  assert.doesNotMatch(markup, /<h1/);
  for (const message of ["", "הצעדים נשמרו."])
    assert.match(
      render(h(SuccessFeedback, { message })),
      /role="status" aria-atomic="true"/,
    );
});
test("auth forms have visible labels, password guidance, and no public signup navigation", () => {
  const markup = render(
    h(AuthForm, {
      action: async () => ({}),
      submitLabel: "כניסה",
      fields: [
        { name: "email", label: "אימייל", type: "email" },
        { name: "password", label: "סיסמה", type: "password", minLength: 10 },
      ],
    }),
  );
  assert.match(markup, /<label/);
  assert.match(markup, /<input(?=[^>]*name="email")(?=[^>]*dir="ltr")[^>]*>/);
  assert.match(markup, /לפחות 10 תווים/);
  assert.doesNotMatch(markup, /href="\/(signup|register)/);
});
test("record not-found feedback provides a single heading and safe return destination", () => {
  const markup = render(
    h(RecordNotFound, {
      title: "המתאמן לא נמצא.",
      href: "/coach",
      label: "חזרה למתאמנים שלי",
    }),
  );
  assert.equal((markup.match(/<h1/g) ?? []).length, 1);
  assert.match(markup, /המתאמן לא נמצא/);
  assert.match(markup, /href="\/coach"/);
});

test("text, focus and input boundaries retain accessible contrast", () => {
  const css = readFileSync(
    new URL("../src/styles/globals.css", import.meta.url),
    "utf8",
  );
  function luminance(name: string) {
    const hex = css.match(new RegExp(`--${name}: #([a-f0-9]{6})`))?.[1];
    assert.ok(hex, `Missing color token ${name}`);
    return [0, 2, 4]
      .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      )
      .reduce(
        (sum, channel, index) =>
          sum + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0),
        0,
      );
  }
  for (const [foreground, background, minimum] of [
    ["foreground", "background", 4.5],
    ["muted-foreground", "card", 4.5],
    ["primary", "primary-foreground", 4.5],
    ["destructive", "card", 4.5],
    ["ring", "background", 3],
    ["input", "background", 3],
  ] as const) {
    const a = luminance(foreground),
      b = luminance(background);
    assert.ok(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= minimum,
      `${foreground}/${background}`,
    );
  }
});
