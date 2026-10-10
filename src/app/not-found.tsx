import Link from "next/link";
import { EmptyState } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      title="העמוד לא נמצא"
      description="ייתכן שהקישור השתנה או שהעמוד אינו זמין."
    >
      <Button asChild>
        <Link href="/">חזרה לעמוד הראשי</Link>
      </Button>
    </EmptyState>
  );
}
