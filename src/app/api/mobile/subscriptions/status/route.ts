import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { ok, unauthorized } from '@/server/http';
import { getAuthSession } from '@/server/auth';

export const GET = withApiError(async function GET(_req: NextRequest) {
  const session = await getAuthSession();
  const user = session?.user as { id?: string } | undefined;
  if (!user?.id) return unauthorized();

  // FREE MODE: Always return active subscription with unlimited access
  return ok({
    active: true,
    productId: 'free_unlimited',
    expiresAt: null,
    lastPurchaseAt: new Date().toISOString(),
    lastTransactionId: 'free_tier',
    environment: 'free',
    cancelAtPeriodEnd: false,
    cancellationEffectiveAt: null,
    plans: [
      {
        planKey: 'unlimited',
        productId: 'free_unlimited',
        label: 'Free Unlimited',
        interval: 'lifetime',
        priceUsd: 0,
        tokens: 999999,
        configured: true,
      },
    ],
    stripeReady: false,
    canManageBilling: false,
  });
}, 'Failed to load subscription status');
