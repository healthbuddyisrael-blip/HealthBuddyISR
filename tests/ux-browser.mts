// Local Edge/CDP audit: real public routes and explicitly separate SSR fixtures.
// No authentication, database, or server actions are mocked or bypassed.
import "./tsx-loader.mts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { createElement as h } from "react";
import { renderWithRouter as render } from "./calendar-renderer.mts";
import { weeklyCalendarDays } from "../src/lib/steps/model.ts";
const { TodayStepCard } =
  await import("../src/components/steps/today-step-card.tsx");
const { WeeklyStepCalendar } =
  await import("../src/components/steps/weekly-step-calendar.tsx");
const { TraineeList } =
  await import("../src/components/coach/trainee-list.tsx");
const { CoachAnalyticsList } =
  await import("../src/components/admin/coach-analytics-list.tsx");
const { AnalyticsMetrics } =
  await import("../src/components/admin/analytics-metrics.tsx");
const { DayDetailDialog } =
  await import("../src/components/coach/day-detail-dialog.tsx");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3114";
const artifact = resolve(".local-postgres/weekly-calendar-browser");
mkdirSync(artifact, { recursive: true });
console.log(`Auditing local application at ${base}`);
const login = await (
  await fetch(`${base}/login`, { signal: AbortSignal.timeout(10000) })
).text();
const styles = [...login.matchAll(/<link[^>]*href="([^"]+\.css[^\"]*)"/g)]
  .map((match) => `<link rel="stylesheet" href="${base}${match[1]}">`)
  .join("");
assert.ok(styles, "Run a built application before the browser audit");
const today = "2026-10-02";
const metric = {
  trainee_count: 25,
  active_trainee_count: 20,
  reported_days: 130,
  expected_days: 175,
  eligible_reported_days: 130,
  target_reached_days: 100,
  reporting_rate: 74.285714,
  target_attainment_rate: 76.92307,
  average_completion: 1100,
};
const name = "אלכסנדר בן-דוד כהן לוי";
const day = {
  date: today,
  steps: 2147483647,
  target: 1,
  percentage: 214748364700,
  future: false,
};
const fixtures: Record<string, string> = {
  trainee: render(
    h(
      "div",
      { className: "mx-auto max-w-2xl space-y-6" },
      h("h1", { className: "text-2xl font-bold" }, `שלום, ${name}`),
      h(TodayStepCard, { day, onEdit: () => {} }),
      h(WeeklyStepCalendar, {
        today,
        week: "2026-09-27",
        days: weeklyCalendarDays(
          "2026-09-27",
          today,
          [
            { date: "2026-10-01", steps: 100000 },
            { date: today, steps: 0 },
          ],
          [{ effective_from: "2026-10-01", target_steps: 10000 }],
        ),
        pending: false,
        onEdit: () => {},
      }),
    ),
  ),
  missing: render(
    h(TodayStepCard, {
      day: { ...day, steps: null, percentage: null, target: 10000 },
      onEdit: () => {},
    }),
  ),
  coach: render(
    h(TraineeList, {
      today,
      trainees: [0, null, 2147483647].map((steps, index) => ({
        trainee_id: String(index),
        full_name: name,
        today_steps: steps,
        today_target: 10000,
        last_reported_date: steps === null ? null : today,
      })),
    }),
  ),
  admin: render(
    h(
      "div",
      { className: "space-y-6" },
      h(AnalyticsMetrics, {
        system: true,
        metrics: { ...metric, coach_count: 12 },
      }),
      h(CoachAnalyticsList, {
        range: 7,
        coaches: [
          {
            ...metric,
            coach_id: "test-fixture",
            full_name: name,
            email: `${"long-email-address-".repeat(6)}@example.test`,
          },
        ],
      }),
    ),
  ),
  day: render(h(DayDetailDialog, { day, onClose: () => {} })),
};
const server = createServer((request, response) => {
  const fixture = fixtures[request.url?.slice(1) ?? ""];
  response.writeHead(fixture ? 200 : 404, {
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(
    `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body><main class="mx-auto max-w-5xl px-4 py-6 sm:px-8">${fixture ?? ""}</main></body></html>`,
  );
});
await new Promise<void>((done) => server.listen(3115, "127.0.0.1", done));
const browser = spawn(
  process.env.TEST_EDGE_PATH ??
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--no-first-run",
    "--disable-sync",
    "--disable-features=msImplicitSignin",
    "--remote-debugging-port=9337",
    `--user-data-dir=${resolve(artifact, `profile-${Date.now()}`)}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
);
let browserError = "";
browser.stderr.on("data", (data) => {
  browserError += String(data);
});
let socket: WebSocket | undefined;
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
try {
  let target: { webSocketDebuggerUrl: string } | undefined;
  for (let attempt = 0; attempt < 100 && !target; attempt++) {
    assert.equal(
      browser.exitCode,
      null,
      browserError || "Edge exited before opening the debugging endpoint",
    );
    try {
      target = await (
        await fetch("http://127.0.0.1:9337/json/new?about:blank", {
          method: "PUT",
          signal: AbortSignal.timeout(1000),
        })
      ).json();
    } catch {
      await pause(100);
    }
  }
  assert.ok(target, `Edge debugging endpoint unavailable: ${browserError}`);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((done, reject) => {
    socket!.onopen = () => done();
    socket!.onerror = reject;
  });
  let sequence = 0;
  const awaiting = new Map<
    number,
    { resolve: (value: CommandResult) => void; reject: (error: Error) => void }
  >();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const waiter = awaiting.get(message.id);
      awaiting.delete(message.id);
      if (message.error)
        waiter?.reject(new Error(JSON.stringify(message.error)));
      else waiter?.resolve(message.result);
    }
  };
  type CommandResult = {
    result?: { value?: unknown };
    exceptionDetails?: unknown;
    data?: string;
  };
  function command(
    method: string,
    params: object = {},
  ): Promise<CommandResult> {
    return new Promise((done, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => {
        awaiting.delete(id);
        reject(new Error(`CDP timed out: ${method}`));
      }, 15000);
      awaiting.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          done(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      socket!.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate<T = unknown>(expression: string): Promise<T> {
    const result = await command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    assert.ok(
      !result.exceptionDetails,
      JSON.stringify(result.exceptionDetails),
    );
    return result.result?.value as T;
  }
  await command("Page.enable");
  const results: object[] = [];
  const routes = [
    "/",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/invite/not-a-token",
  ];
  const screens = [
    ...routes.map((path, index) => ({
      name: `public-${index}`,
      url: base + path,
      fixture: false,
    })),
    ...Object.keys(fixtures).map((name) => ({
      name,
      url: `http://127.0.0.1:3115/${name}`,
      fixture: true,
    })),
  ];
  for (const screen of screens) {
    for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
      console.log(`Checking ${screen.name} at ${width}px`);
      await command("Emulation.setDeviceMetricsOverride", {
        width,
        height: 844,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      await command("Page.navigate", { url: screen.url });
      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          await evaluate(
            `location.href === ${JSON.stringify(screen.url)} && document.readyState === 'complete' && !!document.querySelector('main')`,
          )
        )
          break;
        await pause(50);
      }
      await pause(100);
      if (screen.name === "day")
        await evaluate("document.querySelector('dialog').showModal()");
      const state = await evaluate<{
        lang: string;
        dir: string;
        width: number;
        scroll: number;
        headings: number;
        overflow: string[];
      }>(
        `({lang:document.documentElement.lang,dir:document.documentElement.dir,width:innerWidth,scroll:document.documentElement.scrollWidth,headings:document.querySelectorAll('h1').length,overflow:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left < -1 || r.right > innerWidth+1)}).slice(0,5).map(e=>e.tagName+':'+e.textContent?.slice(0,60))})`,
      );
      assert.equal(state.lang, "he");
      assert.equal(state.dir, "rtl");
      assert.equal(
        state.width,
        width,
        `${screen.name}: viewport must retain the requested width`,
      );
      assert.ok(
        state.scroll <= state.width + 1,
        `${screen.name} ${width}: page overflow ${JSON.stringify(state)}`,
      );
      assert.deepEqual(
        state.overflow,
        [],
        `${screen.name} ${width}: element overflow`,
      );
      if (!screen.fixture)
        assert.equal(state.headings, 1, `${screen.name}: one primary heading`);
      if (screen.name === "trainee" || screen.name === "missing")
        assert.ok(
          await evaluate(
            "[...document.querySelectorAll('button')].find(e=>/הזנת צעדים|עדכון צעדים/.test(e.textContent)).getBoundingClientRect().bottom < innerHeight",
          ),
          "Primary CTA above fold",
        );
      if (screen.name === "day") {
        assert.equal(
          await evaluate("document.activeElement.textContent"),
          "סגירה",
        );
      }
      if (width === 390 || width === 1440) {
        const shot = await command("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        });
        writeFileSync(
          resolve(artifact, `${screen.name}-${width}.png`),
          Buffer.from(shot.data!, "base64"),
        );
      }
      if (screen.name === "day") {
        await command("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
        });
        await command("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
        });
        assert.equal(
          await evaluate("document.querySelector('dialog').open"),
          false,
        );
      }
      if (screen.name === "public-1" && width === 390) {
        await evaluate("document.querySelector('input[name=email]').focus()");
        await command("Input.insertText", { text: "invalid-email" });
        await command("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Tab",
          code: "Tab",
          windowsVirtualKeyCode: 9,
        });
        await command("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Tab",
          code: "Tab",
          windowsVirtualKeyCode: 9,
        });
        assert.equal(await evaluate("document.activeElement.name"), "password");
        await command("Input.insertText", { text: "invalid-test-password" });
        await evaluate(
          "document.querySelector('form button[type=submit]').click()",
        );
        assert.equal(
          await evaluate(
            "document.querySelector('input[name=email]').validationMessage",
          ),
          "יש להזין כתובת אימייל תקינה.",
        );
        assert.equal(
          await evaluate("document.querySelector('input[name=email]').value"),
          "invalid-email",
        );
      }
      results.push({ screen: screen.name, url: screen.url, ...state });
    }
    console.log(
      `${screen.name}: seven widths passed (${screen.fixture ? "SSR test fixture" : "real public route"})`,
    );
  }
  writeFileSync(
    resolve(artifact, "results.json"),
    JSON.stringify(results, null, 2),
  );
} finally {
  socket?.close();
  browser.kill();
  server.close();
}
