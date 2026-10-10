import Link from "next/link";
import { Button } from "@/components/ui/button";

// The shell supplies the role from the verified server-side profile.
export function RoleNavigation({
  role,
}: {
  role: "admin" | "coach" | "trainee";
}) {
  const links: [string, string][] =
    role === "admin"
      ? [
          ["/admin", "סקירה"],
          ["/admin/pilot", "דיווחי פיילוט"],
          ["/admin/coaching", "שיחות שבועיות"],
          ["/admin/invitations", "הזמנות מאמנים"],
        ]
      : role === "coach"
        ? [
            ["/coach", "המתאמנים שלי"],
            ["/coach/pilot", "דיווח שבועי"],
            ["/coach/invitations", "הזמנות"],
          ]
        : [["/app", "היום"]];
  return (
    <nav aria-label="ניווט ראשי" className="flex flex-wrap items-center gap-1">
      {links.map(([href, label]) => (
        <Button key={href} asChild variant="ghost" size="sm">
          <Link href={href}>{label}</Link>
        </Button>
      ))}
    </nav>
  );
}
