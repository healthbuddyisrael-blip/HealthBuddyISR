"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Root layout (and its stylesheet) may be unavailable in this error boundary.
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: "Arial, sans-serif", padding: "2rem" }}>
        <main>
          <h1>לא הצלחנו לטעון את המערכת</h1>
          <p>אפשר לנסות שוב בעוד רגע.</p>
          <button
            onClick={reset}
            style={{ minHeight: 48, padding: "0.75rem 1.5rem" }}
          >
            ניסיון נוסף
          </button>
        </main>
      </body>
    </html>
  );
}
