import { prisma } from '@/server/db';
import {
  EMAIL_KIND_SUBSCRIPTION_WINBACK,
  normalizeEmail,
  sendLocalizedPlainTextEmail,
} from '@/server/emails/planned';
import { TOKEN_COSTS, TOKEN_TRANSACTION_TYPES } from '@/shared/constants/token-costs';
import { grantTokens, makeSystemInitiator, TokenLedgerClient } from '@/server/tokens';

type MarkSubscriptionCancellationInput = {
  userId: string;
  email?: string | null;
  name?: string | null;
  preferredLanguage?: string | null;
  productId?: string | null;
};

export type MarkSubscriptionCancellationResult = {
  marked: boolean;
  emailSent: boolean;
  emailError: string | null;
};

export async function markSubscriptionCancellationForWinback(
  input: MarkSubscriptionCancellationInput,
): Promise<MarkSubscriptionCancellationResult> {
  const now = new Date();
  const updated = await prisma.user.updateMany({
    where: {
      id: input.userId,
      deleted: false,
      subscriptionWinbackBonusPending: false,
    },
    data: {
      subscriptionWinbackBonusPending: true,
      subscriptionWinbackBonusPendingAt: now,
    },
  });

  if (updated.count === 0) {
    return {
      marked: false,
      emailSent: false,
      emailError: null,
    };
  }

  const to = normalizeEmail(input.email);
  if (!to) {
    return {
      marked: true,
      emailSent: false,
      emailError: 'User email is missing or invalid.',
    };
  }

  const result = await sendLocalizedPlainTextEmail({
    to,
    kind: EMAIL_KIND_SUBSCRIPTION_WINBACK,
    languageHint: input.preferredLanguage,
    name: input.name,
    variables: {
      resubscribe_bonus_tokens: String(TOKEN_COSTS.subscriptionWinbackBonus),
      product_id: input.productId ?? '',
    },
  });

  return {
    marked: true,
    emailSent: result.ok,
    emailError: result.ok ? null : (result.error ?? 'Unknown email send error'),
  };
}

type GrantSubscriptionWinbackBonusInput = {
  userId: string;
  sourceTransactionId: string;
  productId: string;
};

export type GrantSubscriptionWinbackBonusResult = {
  granted: boolean;
  tokensGranted: number;
  balance: number | null;
};

export async function grantSubscriptionWinbackBonusOnResubscribe(
  input: GrantSubscriptionWinbackBonusInput,
  client?: TokenLedgerClient,
): Promise<GrantSubscriptionWinbackBonusResult> {
  const runner = client ?? prisma;
  const now = new Date();
  const sourceId = input.sourceTransactionId.trim().slice(0, 191);

  const updated = await runner.user.updateMany({
    where: {
      id: input.userId,
      deleted: false,
      subscriptionWinbackBonusPending: true,
    },
    data: {
      subscriptionWinbackBonusPending: false,
      subscriptionWinbackBonusGrantedAt: now,
      subscriptionWinbackBonusGrantedSourceId: sourceId || null,
    },
  });

  if (updated.count === 0) {
    return {
      granted: false,
      tokensGranted: 0,
      balance: null,
    };
  }

  const balance = await grantTokens(
    {
      userId: input.userId,
      amount: TOKEN_COSTS.subscriptionWinbackBonus,
      type: TOKEN_TRANSACTION_TYPES.subscriptionWinbackBonus,
      description: 'Subscription return bonus',
      initiator: makeSystemInitiator('subscription-winback-bonus'),
      metadata: {
        sourceTransactionId: input.sourceTransactionId,
        productId: input.productId,
      },
    },
    runner,
  );

  return {
    granted: true,
    tokensGranted: TOKEN_COSTS.subscriptionWinbackBonus,
    balance,
  };
}
