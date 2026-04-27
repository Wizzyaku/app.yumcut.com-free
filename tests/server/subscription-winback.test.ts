import { beforeEach, describe, expect, it, vi } from 'vitest';

const userUpdateMany = vi.hoisted(() => vi.fn());
const grantTokens = vi.hoisted(() => vi.fn());
const sendLocalizedPlainTextEmail = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      updateMany: userUpdateMany,
    },
  },
}));

vi.mock('@/server/tokens', () => ({
  grantTokens,
  makeSystemInitiator: (tag: string) => `system:${tag}`,
}));

vi.mock('@/server/emails/planned', () => ({
  EMAIL_KIND_SUBSCRIPTION_WINBACK: 'subscription_cancelled_winback_v1',
  normalizeEmail: (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed.includes('@') ? trimmed : null;
  },
  sendLocalizedPlainTextEmail,
}));

const {
  grantSubscriptionWinbackBonusOnResubscribe,
  markSubscriptionCancellationForWinback,
} = await import('@/server/subscription-winback');

describe('subscription winback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userUpdateMany.mockResolvedValue({ count: 1 });
    sendLocalizedPlainTextEmail.mockResolvedValue({ ok: true, id: 'email-1', language: 'en' });
    grantTokens.mockResolvedValue(500);
  });

  it('marks cancellation and sends immediate winback email once', async () => {
    const result = await markSubscriptionCancellationForWinback({
      userId: 'user-1',
      email: 'user@example.com',
      name: 'Max',
      preferredLanguage: 'en',
      productId: 'yumcut_weekly_basic',
    });

    expect(result).toEqual({
      marked: true,
      emailSent: true,
      emailError: null,
    });
    expect(userUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'user-1',
          subscriptionWinbackBonusPending: false,
        }),
        data: expect.objectContaining({
          subscriptionWinbackBonusPending: true,
        }),
      }),
    );
    expect(sendLocalizedPlainTextEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        kind: 'subscription_cancelled_winback_v1',
        languageHint: 'en',
        variables: expect.objectContaining({
          resubscribe_bonus_tokens: '100',
        }),
      }),
    );
  });

  it('does not send winback email when cancellation is already marked', async () => {
    userUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await markSubscriptionCancellationForWinback({
      userId: 'user-1',
      email: 'user@example.com',
      name: 'Max',
      preferredLanguage: 'en',
    });

    expect(result).toEqual({
      marked: false,
      emailSent: false,
      emailError: null,
    });
    expect(sendLocalizedPlainTextEmail).not.toHaveBeenCalled();
  });

  it('grants one-time 100-token bonus on resubscribe when pending', async () => {
    const result = await grantSubscriptionWinbackBonusOnResubscribe({
      userId: 'user-1',
      sourceTransactionId: 'tx-1',
      productId: 'yumcut_weekly_basic',
    });

    expect(result).toEqual({
      granted: true,
      tokensGranted: 100,
      balance: 500,
    });
    expect(grantTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 100,
        type: 'SUBSCRIPTION_WINBACK_BONUS',
      }),
      expect.anything(),
    );
  });

  it('does not grant resubscribe bonus when user is not pending', async () => {
    userUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await grantSubscriptionWinbackBonusOnResubscribe({
      userId: 'user-1',
      sourceTransactionId: 'tx-2',
      productId: 'yumcut_monthly_basic',
    });

    expect(result).toEqual({
      granted: false,
      tokensGranted: 0,
      balance: null,
    });
    expect(grantTokens).not.toHaveBeenCalled();
  });
});
