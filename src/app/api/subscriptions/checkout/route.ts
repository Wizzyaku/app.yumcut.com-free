import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { error, unauthorized } from '@/server/http';
import { getAuthSession } from '@/server/auth';

export const POST = withApiError(async function POST(req: NextRequest) {
  const session = await getAuthSession();
  const user = session?.user as { id?: string; email?: string | null } | undefined;
  if (!user?.id) return unauthorized();

  // FREE MODE: Subscription checkout is disabled
  return error(
    'FREE_MODE',
    'This application is completely free. No subscriptions available.',
    403,
  );
}, 'Subscriptions are disabled in free mode');
