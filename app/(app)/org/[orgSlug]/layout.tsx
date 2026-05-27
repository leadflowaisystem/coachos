import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { Zap } from "lucide-react";
import { OrgSwitcher } from "@/components/org/org-switcher";

interface Props {
  children: React.ReactNode;
  params: { orgSlug: string };
}

export default async function OrgLayout({ children, params }: Props) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify org exists and user is a member
  const { data: orgData } = await supabase
    .from("orgs")
    .select("id, slug, name, onboarding_completed_at")
    .eq("slug", params.orgSlug)
    .single();

  const org = orgData as {
    id: string;
    slug: string;
    name: string;
    onboarding_completed_at: string | null;
  } | null;

  if (!org) notFound();

  const { data: membershipData } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .single();

  if (!membershipData) redirect("/onboarding");

  // Redirect to wizard if onboarding hasn't been completed.
  // Skip when already on the onboarding sub-path (avoids redirect loop).
  const pathname = headers().get("x-pathname") ?? "";
  const isOnboardingPath = pathname.includes("/onboarding");

  if (!org.onboarding_completed_at && !isOnboardingPath) {
    redirect(`/org/${params.orgSlug}/onboarding`);
  }

  // All orgs this user belongs to (for the org switcher)
  const { data: allMemberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  const orgIds =
    (allMemberships as { org_id: string }[] | null)?.map((m) => m.org_id) ?? [];

  const { data: allOrgsData } = await supabase
    .from("orgs")
    .select("id, slug, name")
    .in("id", orgIds);

  const orgs =
    (allOrgsData as { id: string; slug: string; name: string }[] | null) ?? [];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* ── Topbar — only shown when NOT on the onboarding wizard ── */}
      {!isOnboardingPath && (
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-1)] px-5">
          <div className="flex items-center gap-2 shrink-0">
            <Zap className="h-4 w-4 text-[var(--brand)]" />
            <span className="font-display text-sm font-semibold text-[var(--text)]">
              CoachOS
            </span>
          </div>
          <OrgSwitcher orgs={orgs} currentSlug={params.orgSlug} />
          <div className="ml-auto text-xs text-[var(--text-3)] truncate max-w-[200px]">
            {user.email}
          </div>
        </header>
      )}
      {isOnboardingPath ? (
        children
      ) : (
        <main className="p-6">{children}</main>
      )}
    </div>
  );
}
