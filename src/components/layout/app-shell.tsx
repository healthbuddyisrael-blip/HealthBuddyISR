import Link from "next/link";
import { Footprints } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth/session";
import { RoleNavigation } from "./role-navigation";
import { logout } from "@/app/auth/actions";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-background p-4 focus:not-sr-only focus:absolute focus:start-4 focus:top-4"
      >
        דילוג לתוכן הראשי
      </a>
      <header className="border-b border-primary/20 bg-muted shadow-sm">
        <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 sm:px-8">
          <Link
            href="/"
            className="flex min-h-12 items-center gap-2 rounded-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Footprints className="size-6 text-primary" aria-hidden="true" />
            <bdi dir="ltr">{APP_NAME}</bdi>
            {profile && profile.role !== "trainee" && (
              <span className="text-xs font-normal text-muted-foreground">
                {profile.role === "admin" ? "מנהל" : "מאמן"}
              </span>
            )}
          </Link>
          <div>
            {profile ? (
              <div className="flex flex-wrap items-center gap-1">
                <RoleNavigation role={profile.role} />
                <form action={logout}>
                  <Button variant="outline" size="sm">
                    התנתקות
                  </Button>
                </form>
              </div>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">כניסה למערכת</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-6 sm:px-8 sm:py-10"
      >
        {children}
      </main>
      <footer className="px-5 py-6 text-center text-sm text-muted-foreground">
        <bdi dir="ltr">{APP_NAME}</bdi> · צעד קטן, בכל יום
      </footer>
    </div>
  );
}
