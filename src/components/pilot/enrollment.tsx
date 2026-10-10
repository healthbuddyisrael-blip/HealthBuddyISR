"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function PilotEnrollment({
  options,
  start,
}: {
  options: {
    id: string;
    full_name: string;
    membership?: { starts_on: string; ends_on: string | null } | null;
  }[];
  start: string;
}) {
  const [message, setMessage] = useState("");
  const [pending, transition] = useTransition();
  const router = useRouter();
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const membership = options.find((p) => p.id === selected)?.membership;
  return (
    <form
      className="space-y-3 rounded-2xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        transition(async () => {
          try {
            const { setPilotEnrollment } = await import("@/app/pilot/actions");
            const result = await setPilotEnrollment(form);
            setMessage(result.message);
            if (result.ok) router.refresh();
          } catch {
            setMessage("השיוך לא נשמר. נסו שוב.");
          }
        });
      }}
    >
      <h2 className="text-lg font-bold">ניהול משתתפי הפיילוט</h2>
      <p className="text-sm">
        רק משתתפים ששויכו במפורש עוברים לדיווח מאמן. דיווחים היסטוריים נשמרים.
      </p>
      <label className="block font-semibold">
        משתתף
        <select
          name="traineeId"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
          className="mt-2 min-h-12 w-full rounded-xl border bg-background p-3"
        >
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="block font-semibold">
        תחילת שבוע ראשון בפיילוט
        <Input
          key={`${selected}:start:${membership?.starts_on}`}
          name="start"
          type="date"
          defaultValue={membership?.starts_on ?? start}
          required
        />
      </label>
      <label className="block font-semibold">
        יום סיום (ריק לפיילוט מתמשך)
        <Input
          key={`${selected}:end:${membership?.ends_on}`}
          name="end"
          type="date"
          defaultValue={membership?.ends_on ?? ""}
        />
      </label>
      <Button disabled={pending || !options.length}>שמירת שיוך</Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
