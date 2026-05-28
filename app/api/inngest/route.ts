import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { testNoOp }         from "@/lib/inngest/functions/test";
import { onDmReceived }     from "@/lib/inngest/functions/on-dm-received";
import { onBookingCreated } from "@/lib/inngest/functions/on-booking-created";
import { onBookingNoShow }  from "@/lib/inngest/functions/on-booking-no-show";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [testNoOp, onDmReceived, onBookingCreated, onBookingNoShow],
});
