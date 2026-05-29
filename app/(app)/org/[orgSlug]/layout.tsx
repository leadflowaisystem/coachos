import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { TrialExpiredModal } from "@/components/layout/trial-expired-modal";

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
    .select("id, slug, name, onboarding_completed_at, plan, trial_ends_at")
    .eq("slug", params.orgSlug)
    .single();

  const org = orgData as {
    id: string;
    slug: string;
    name: string;
    onboarding_completed_at: string | null;
    plan: string;
    trial_ends_at: string | null;
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

  // Onboarding wizard uses fixed overlay — render children bare
  if (isOnboardingPath) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        {children}
      </div>
    );
  }

  return (
    <AppShell
      orgSlug={params.orgSlug}
      orgName={org.name}
      orgs={orgs}
      user={{ email: user.email ?? undefined }}
    >
      {/* Trial expired modal — client component, renders nothing if not expired */}
      <TrialExpiredModal
        plan={org.plan ?? "trial"}
        trialEndsAt={org.trial_ends_at ?? null}
        orgSlug={params.orgSlug}
      />
      {children}
    </AppShell>
  );
}
