import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, dashboardPathForRole } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState } from "@/components/ui/sithelo";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatDate } from "@/lib/format";

// The notifications table has been written to since the first migration
// (verification decisions, expiring documents, new matches) but nothing
// ever showed it. RLS limits reads to the recipient, and the only column a
// recipient may change is is_read (migrations 014/021).

const CATEGORY_LABEL: Record<string, string> = {
  verification: "Verification",
  invitation: "New match",
  application: "Application",
  approval: "Approval",
  document_expiry: "Document expiry",
  trust_score: "Trust score",
};

// Where a notification leads, from the ids the writers put in metadata.
function linkFor(role: string, metadata: Record<string, unknown> | null): string | null {
  const m = metadata ?? {};
  if (role === "entrepreneur" && typeof m.opportunity_id === "string") return `/entrepreneur/opportunities/${m.opportunity_id}`;
  if (typeof m.passport_id === "string") return `/passport/${m.passport_id}`;
  return null;
}

async function markAllReadAction() {
  "use server";
  const { userId } = await requireAuth();
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", userId).eq("is_read", false);
  revalidatePath("/notifications", "layout");
}

async function openNotificationAction(formData: FormData) {
  "use server";
  const { userId } = await requireAuth();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const href = String(formData.get("href") ?? "");
  await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("recipient_id", userId);
  revalidatePath("/notifications", "layout");
  // Only internal paths built by linkFor() above.
  if (/^\/(entrepreneur\/opportunities|passport)\/[0-9a-f-]{36}$/i.test(href)) redirect(href);
}

export default async function NotificationsPage() {
  const { userId, profile } = await requireAuth();
  if (profile.role === "admin") redirect(dashboardPathForRole("admin"));
  const supabase = await createClient();

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id, category, title, body, is_read, metadata, created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const unread = (notifications ?? []).filter((n) => !n.is_read).length;

  return (
    <PortalShell portal={profile.role} userName={profile.full_name}>
      <div className="mb-10 rule border-b pb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-3">Notifications</div>
          <h1 className="text-display-lg font-display font-medium text-navy leading-tight">
            {unread > 0 ? `${unread} unread` : "You're up to date"}
          </h1>
        </div>
        {unread > 0 && (
          <form action={markAllReadAction}>
            <SubmitButton className="btn-ghost !py-2 !px-4" pendingLabel="Marking…">Mark all as read</SubmitButton>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-ink-600 py-10">We couldn&apos;t load your notifications right now. Please try again.</p>}

      {!error && (!notifications || notifications.length === 0) && (
        <SitheloEmptyState
          title="No notifications yet"
          body="We'll let you know here when a document is reviewed, an opportunity matches your business, or an application changes."
        />
      )}

      {!error && notifications && notifications.length > 0 && (
        <ul className="rule border-t">
          {notifications.map((n) => {
            const href = linkFor(profile.role, n.metadata as Record<string, unknown> | null);
            return (
              <li key={n.id} className={`border-b border-line py-5 grid grid-cols-[12px_1fr_auto] gap-x-4 ${n.is_read ? "" : "bg-white -mx-4 px-4"}`}>
                <span
                  aria-hidden="true"
                  className={`mt-2 w-2 h-2 rounded-full ${n.is_read ? "bg-transparent" : "bg-blue-600"}`}
                />
                <div className="min-w-0">
                  <div className="text-eyebrow uppercase text-ink-500 mb-1">
                    {CATEGORY_LABEL[n.category] ?? n.category}
                    {!n.is_read && <span className="sr-only"> (unread)</span>}
                  </div>
                  <div className={`text-navy ${n.is_read ? "" : "font-semibold"}`}>{n.title}</div>
                  {n.body && <p className="text-sm text-ink-600 mt-1 leading-relaxed">{n.body}</p>}
                  {href && (
                    <form action={openNotificationAction} className="mt-2">
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="href" value={href} />
                      <SubmitButton className="btn-text !text-sm" pendingLabel="Opening…">View →</SubmitButton>
                    </form>
                  )}
                </div>
                <time className="text-xs text-ink-500 whitespace-nowrap" dateTime={n.created_at}>
                  {formatDate(n.created_at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-ink-500 mt-10">
        Showing your latest 100 notifications. <Link href={dashboardPathForRole(profile.role)} className="btn-text !text-xs">Back to home</Link>
      </p>
    </PortalShell>
  );
}
