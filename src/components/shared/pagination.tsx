import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NavigationPending } from "./navigation-pending";

export function Pagination({
  previous,
  next,
  label = "עמודי תוצאות",
}: {
  previous?: string;
  next?: string;
  label?: string;
}) {
  if (!previous && !next) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap gap-3">
      {previous && (
        <Button asChild variant="outline">
          <Link href={previous}>
            הקודם
            <NavigationPending />
          </Link>
        </Button>
      )}
      {next && (
        <Button asChild variant="outline">
          <Link href={next}>
            הבא
            <NavigationPending />
          </Link>
        </Button>
      )}
    </nav>
  );
}
