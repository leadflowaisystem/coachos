/**
 * Wraps an API route handler in a try/catch that always returns valid JSON.
 * Usage:
 *   export const POST = withErrorHandler("route-name", async (req, ctx) => { ... });
 */

import { NextRequest, NextResponse } from "next/server";

type Handler<C = unknown> = (req: NextRequest, ctx: C) => Promise<NextResponse>;

export function withErrorHandler<C = unknown>(
  routeName: string,
  handler: Handler<C>,
): Handler<C> {
  return async (req: NextRequest, ctx: C) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      console.error(`[${routeName}] unhandled error:`, err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
