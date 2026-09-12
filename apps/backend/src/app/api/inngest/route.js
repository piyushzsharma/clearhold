import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { escrowAutoRelease } from '@/inngest/autoRelease';
import { escrowTimeoutRefund } from '@/inngest/timeoutRefund';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    escrowAutoRelease,
    escrowTimeoutRefund,
  ],
});
