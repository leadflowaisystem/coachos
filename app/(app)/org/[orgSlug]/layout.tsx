import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
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
    .select("id, slug, name")
    .eq("slug", params.orgSlug)
    .single();

  const org = orgData as { id: string; slug: string; name: string } | null;
  if (!org) notFound();

  const { data: membershipData } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .single();

  if (!membershipData) redirect("/onboarding");

  // All orgs this user belongs to (for switcher)
  const { data: allMemberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  const orgIds = (allMemberships as { org_id: string }[] | null)?.map((m) => m.org_id) ?? [];

  const { data: allOrgsData } = await supabase.from("orgs").select("id, slug, name").in("id", orgIds);

  const orgs = (allOrgsData as { id: string; slug: string; name: string }[] | null) ?? [];

  return (
    <div className="min-h-screen">
      <header className="border-b px-4 py-3 flex items-center gap-4">
        <span className="font-display text-lg font-semibold">CoachOS</span>
        <OrgSwitcher orgs={orgs} currentSlug={params.orgSlug} />
        <div className="ml-auto text-sm text-muted-foreground">{user.email}</div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
