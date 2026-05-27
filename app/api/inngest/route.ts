import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { testNoOp } from "@/lib/inngest/functions/test";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [testNoOp],
});
