import Link from "next/link";
import { Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { roleDestination } from "@/lib/auth/routing";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  if (profile) redirect(roleDestination(profile.role));

  return (
    <section className="mx-auto max-w-2xl py-8 text-center sm:py-16">
      <div className="mx-auto mb-8 flex size-20 items-center justify-center rounded-3xl bg-primary/10">
        <Footprints className="size-10 text-primary" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-bold leading-tight sm:text-5xl sm:leading-tight">
        מעקב צעדים פשוט
        <br />
        למאמנים ולמתאמנים
      </h1>
      <p className="mt-6 text-lg leading-8 text-muted-foreground">
        ניהול יעדי צעדים ומעקב יומי במקום אחד.
      </p>
      <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
        <Link href="/login">כניסה למערכת</Link>
      </Button>
      <p className="mt-5 text-sm text-muted-foreground">
        הגישה למערכת בהזמנה בלבד
      </p>
    </section>
  );
}
