import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Find the user's first org membership
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  const orgId = (memberships as { org_id: string }[] | null)?.[0]?.org_id;

  if (orgId) {
    const { data: org } = await supabase
      .from("orgs")
      .select("slug")
      .eq("id", orgId)
      .single();

    const slug = (org as { slug: string } | null)?.slug;
    if (slug) redirect(`/org/${slug}`);
  }

  redirect("/onboarding");
}
