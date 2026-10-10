import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { coachQuery } from "@/lib/coach/model";
import { InvitationManagement } from "@/components/invitations/invitation-management";

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("admin");
  const { page } = coachQuery(await searchParams);
  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex min-h-12 items-center underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        חזרה לסקירת המערכת
      </Link>
      <InvitationManagement
        role="coach"
        page={page}
        basePath="/admin/invitations"
      />
    </div>
  );
}
