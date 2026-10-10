import { InvitationManagement } from "@/components/invitations/invitation-management";
import { requireRole } from "@/lib/auth/session";
import { coachQuery } from "@/lib/coach/model";
import Link from "next/link";

export default async function CoachInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("coach");
  const { page } = coachQuery(await searchParams);
  return (
    <div className="space-y-6">
      <Link
        href="/coach"
        className="inline-flex min-h-12 items-center underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        חזרה למתאמנים שלי
      </Link>
      <InvitationManagement
        role="trainee"
        page={page}
        basePath="/coach/invitations"
      />
    </div>
  );
}
