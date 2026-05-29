# CoachOS Security

## Row Level Security (RLS)

All tables have RLS enabled. Policies:

| Table           | Read                  | Write                        |
|-----------------|-----------------------|------------------------------|
| orgs            | is_org_member(id)     | service role only            |
| org_members     | is_org_member(org_id) | owner insert/delete          |
| integrations    | is_org_member(org_id) | is_org_member (full)         |
| leads           | is_org_member(org_id) | is_org_member (full)         |
| conversations   | is_org_member(org_id) | is_org_member (full)         |
| messages        | is_org_member(org_id) | is_org_member (full)         |
| bookings        | is_org_member(org_id) | is_org_member (full)         |
| payments        | is_org_member(org_id) | is_org_member (full)         |
| sequences       | is_org_member(org_id) | is_org_member (full)         |
| sequence_runs   | is_org_member(org_id) | is_org_member (full)         |
| metrics_daily   | is_org_member(org_id) | members read, service write  |
| ai_drafts       | is_org_member(org_id) | is_org_member (full)         |
| ai_usage        | is_org_member(org_id) | service role only            |
| voice_profiles  | is_org_member(org_id) | is_org_member (full)         |
| waitlist        | false (service only)  | false (service only)         |
| audit_log       | is_org_owner(org_id)  | service role only            |
| user_flags      | self (user_id = uid)  | self                         |

All server-side mutations go through service role in API routes (RLS bypassed intentionally there for cross-org admin ops).

## Webhook Signature Verification

- **Razorpay per-org** (`/api/webhooks/razorpay/[orgId]`): HMAC-SHA256 verified against per-org webhook secret stored encrypted in integrations.config.
- **Razorpay platform** (`/api/webhooks/razorpay-billing`): HMAC-SHA256 verified against `PLATFORM_RAZORPAY_WEBHOOK_SECRET` env var.
- **Cal.com** (`/api/webhooks/calcom/[orgId]`): signature verified against per-org Cal.com webhook secret.

All webhooks reject unsigned requests with HTTP 401.

## Rate Limiting

In-memory rate limiter (`lib/ratelimit.ts`) applied to:
- `POST /api/orgs/[orgId]/inbox/send` — 30 req/min per IP (simulate DM)
- `POST /api/waitlist` — 5 req/min per IP
- `POST /api/billing/subscribe` — authenticated, bounded by Razorpay

Note: In-memory rate limiting resets on cold starts. For production, upgrade to Redis-based rate limiting (Upstash).

## Credential Encryption

Sensitive credentials stored in `integrations.config` are encrypted at rest using AES-256-GCM via `lib/crypto.ts`:
- Razorpay `key_secret_enc`
- Razorpay `webhook_secret_enc`
- Cal.com `webhook_secret_enc`

The `ENCRYPTION_KEY` (32-byte hex) is required in environment variables.

## Admin Access

Admin routes (`/admin/*`) are guarded by email allowlist (`ADMIN_EMAILS` env var). The layout server component checks `isAdminEmail(user.email)` before rendering and redirects to `/` otherwise.

## Environment Variables Required in Production

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
LLM_API_KEY
PLATFORM_RAZORPAY_KEY_ID
PLATFORM_RAZORPAY_KEY_SECRET
PLATFORM_RAZORPAY_WEBHOOK_SECRET
PLATFORM_PLAN_STARTER_ID
PLATFORM_PLAN_GROWTH_ID
PLATFORM_PLAN_PRO_ID
ADMIN_EMAILS
NEXT_PUBLIC_APP_URL
```
