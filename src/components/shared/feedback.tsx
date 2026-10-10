import { CircleCheck, CircleAlert, LoaderCircle } from "lucide-react";

export function LoadingState({
  message = "טוענים את המידע…",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 py-12 text-muted-foreground"
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-5 animate-spin motion-reduce:animate-none"
      />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
  headingLevel = 1,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  headingLevel?: 1 | 2 | 3;
}) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";
  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-center sm:p-10">
      <Heading className="text-xl font-bold sm:text-2xl">{title}</Heading>
      <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">
        {description}
      </p>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}

export function ErrorState({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/30 bg-card p-6"
    >
      <div className="flex items-start gap-3">
        <CircleAlert
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-destructive"
        />
        <p className="min-w-0">{message}</p>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function SuccessFeedback({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-atomic="true"
      className={
        message
          ? "flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
          : "sr-only"
      }
    >
      {message && (
        <CircleCheck
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-primary"
        />
      )}
      <p>{message}</p>
    </div>
  );
}
