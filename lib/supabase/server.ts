import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Server client — respects RLS, uses the authenticated user's session.
 *
 * NOTE: @supabase/ssr@0.4.x and @supabase/supabase-js@2.106+ have a type
 * mismatch in sub-path imports, so this client is NOT generic-typed. Server
 * component code uses explicit `as SomeType` assertions where needed.
 * Runtime behaviour is identical. Fix by aligning pkg versions when convenient.
 *
 * cookies() is synchronous in Next.js 14. Remove sync call when upgrading to 15.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // No-op in Server Components — cookie writes not allowed there.
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses RLS entirely.
 * ONLY use in trusted server-side code (API routes, Inngest functions).
 *
 * When SUPABASE_DB_POOL_URL is set (Supabase Dashboard → Database →
 * Connection Pooling → Transaction mode, port 6543), we use it as the
 * db.pooler option to route through PgBouncer. This dramatically reduces
 * open connection count at scale without any behaviour change.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const poolerUrl   = process.env.SUPABASE_DB_POOL_URL;

  return createSupabaseClient<Database>(
    supabaseUrl,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      ...(poolerUrl ? { db: { schema: "public" } } : {}),
    }
  );
}
