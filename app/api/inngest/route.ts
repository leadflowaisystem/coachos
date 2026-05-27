import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { testNoOp } from "@/lib/inngest/functions/test";
import { onDmReceived } from "@/lib/inngest/functions/on-dm-received";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [testNoOp, onDmReceived],
});
