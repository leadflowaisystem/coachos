import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { testNoOp }                from "@/lib/inngest/functions/test";
import { onDmReceived }            from "@/lib/inngest/functions/on-dm-received";
import { onBookingCreated }        from "@/lib/inngest/functions/on-booking-created";
import { onBookingNoShow }         from "@/lib/inngest/functions/on-booking-no-show";
import { onPaymentCreated }        from "@/lib/inngest/functions/on-payment-created";
import { onPaymentUnpaid }         from "@/lib/inngest/functions/on-payment-unpaid";
import { onGhostRevival }          from "@/lib/inngest/functions/on-ghost-revival";
import { aggregateDailyMetrics }   from "@/lib/inngest/functions/daily-metrics";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    testNoOp,
    onDmReceived,
    onBookingCreated,
    onBookingNoShow,
    onPaymentCreated,
    onPaymentUnpaid,
    onGhostRevival,
    aggregateDailyMetrics,
  ],
});
