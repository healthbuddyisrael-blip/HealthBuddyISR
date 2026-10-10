import { Pagination } from "@/components/shared/pagination";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { APP_LOCALE, APP_TIMEZONE } from "@/lib/config";
import {
  invitationSummarySchema,
  invitationStatus,
  INVITATION_STATUS_LABELS,
} from "@/lib/invitations/model";
import { EmptyState, ErrorState } from "@/components/shared/feedback";
import { InvitationForm } from "./invitation-form";
import { InvitationActions } from "./invitation-actions";

export async function InvitationManagement({
  role,
  page,
  basePath,
}: {
  role: "coach" | "trainee";
  page: number;
  basePath?: string;
}) {
  const client = await createClient();
  // RLS limits coaches to their own invitations. Admin area deliberately lists coach invites only.
  const { data, error, count } = await client
    .from("invitations")
    .select(
      "id,email,role,initial_target_steps,created_at,expires_at,accepted_at,revoked_at",
      { count: "exact" },
    )
    .eq("role", role)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 25, page * 25 - 1);
  const parsed = z.array(invitationSummarySchema).safeParse(data);
  const date = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
  const path = basePath ?? (role === "coach" ? "/admin" : "/coach");
  return (
    <div className="space-y-8">
      <section
        aria-labelledby="invite-heading"
        className="rounded-2xl border bg-card p-5 sm:p-6"
      >
        <h1 id="invite-heading" className="mb-5 text-2xl font-bold">
          {role === "coach" ? "הזמנת מאמן" : "הזמנת מתאמן"}
        </h1>
        <InvitationForm role={role} />
      </section>
      <section aria-labelledby="invitations-heading" className="space-y-4">
        <h2 id="invitations-heading" className="text-xl font-bold">
          {role === "coach" ? "הזמנות למאמנים" : "הזמנות למתאמנים"}
        </h2>
        {error || !parsed.success ? (
          <ErrorState message="לא ניתן לטעון את ההזמנות. נסו לרענן את הדף." />
        ) : !parsed.data.length ? (
          <EmptyState
            headingLevel={3}
            title="עדיין אין הזמנות"
            description="אפשר לשלוח הזמנה בטופס למעלה."
          />
        ) : (
          <ul className="space-y-4">
            {parsed.data.map((invitation) => {
              const status = invitationStatus(invitation);
              return (
                <li
                  key={invitation.id}
                  className="space-y-4 rounded-2xl border bg-card p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span dir="ltr" className="min-w-0 break-all font-semibold">
                      {invitation.email}
                    </span>
                    <span className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
                      {INVITATION_STATUS_LABELS[status]}
                    </span>
                  </div>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="inline font-semibold">נוצרה: </dt>
                      <dd className="inline">
                        {date.format(new Date(invitation.created_at))}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold">תוקף הקישור: </dt>
                      <dd className="inline">
                        {date.format(new Date(invitation.expires_at))}
                      </dd>
                    </div>
                    {invitation.initial_target_steps !== null ? (
                      <div>
                        <dt className="inline font-semibold">
                          יעד צעדים יומי:{" "}
                        </dt>
                        <dd className="inline">
                          {invitation.initial_target_steps.toLocaleString(
                            APP_LOCALE,
                          )}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {status === "pending" || status === "expired" ? (
                    <InvitationActions
                      id={invitation.id}
                      pendingInvitation={status === "pending"}
                    />
                  ) : null}
                  {status === "expired" ? (
                    <p className="text-sm text-muted-foreground">
                      לשליחת קישור חדש יש ליצור הזמנה חדשה בטופס למעלה.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          label="עמודי הזמנות"
          previous={page > 1 ? `${path}?page=${page - 1}` : undefined}
          next={
            count !== null && count > page * 25
              ? `${path}?page=${page + 1}`
              : undefined
          }
        />
      </section>
    </div>
  );
}
