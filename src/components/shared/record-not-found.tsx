import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./feedback";

export function RecordNotFound({
  title,
  href,
  label,
}: {
  title: string;
  href: string;
  label: string;
}) {
  return (
    <EmptyState title={title} description="אפשר לחזור לרשימה ולבחור שוב.">
      <Button asChild variant="outline">
        <Link href={href}>{label}</Link>
      </Button>
    </EmptyState>
  );
}
