import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { publicEnv } from "@/lib/env/public";
import { AppShell } from "@/components/layout/app-shell";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description:
    "מעקב צעדים פשוט למאמנים ולמתאמנים. ניהול יעדי צעדים ומעקב יומי במקום אחד.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
