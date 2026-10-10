import { visualProgress } from "@/lib/steps/model";

export function ProgressRing({
  percentage,
  compact = false,
  emptyLabel = "לא דווח",
}: {
  percentage: number | null;
  compact?: boolean;
  emptyLabel?: string;
}) {
  const progress = visualProgress(percentage);
  const text = percentage === null ? "—" : `${percentage}%`;
  const digits = text.length;
  return (
    <div
      role="img"
      aria-label={
        percentage === null ? emptyLabel : `${percentage}% מהיעד היומי`
      }
      className={`relative shrink-0 ${compact ? "aspect-square w-10 max-w-full sm:w-12" : "size-24 sm:size-36"}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="43"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-muted"
        />
        <circle
          cx="50"
          cy="50"
          r="43"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          pathLength="100"
          strokeDasharray={`${progress} 100`}
          strokeLinecap={progress ? "round" : "butt"}
          className="text-primary"
        />
      </svg>
      <span
        aria-hidden="true"
        dir="ltr"
        className="absolute inset-0 flex items-center justify-center font-bold tabular-nums"
        style={{
          fontSize: compact
            ? `min(12px, ${52 / Math.max(digits, 4)}px)`
            : `min(1.875rem, ${130 / Math.max(digits, 4)}px)`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
