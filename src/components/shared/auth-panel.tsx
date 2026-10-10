export function AuthPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      {children}
    </section>
  );
}
