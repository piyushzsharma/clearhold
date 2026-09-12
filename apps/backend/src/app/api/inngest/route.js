import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest.js';
import { escrowAutoRelease } from '@/inngest/autoRelease.js';
import { escrowTimeoutRefund } from '@/inngest/timeoutRefund.js';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    escrowAutoRelease,
    escrowTimeoutRefund,
  ],
});
