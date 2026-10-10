export default function DashboardLoading() {
  return (
    <div
      role="status"
      className="mx-auto max-w-2xl space-y-6"
      aria-label="טוען את הצעדים"
    >
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      <span className="sr-only">טוען את הצעדים…</span>
    </div>
  );
}
