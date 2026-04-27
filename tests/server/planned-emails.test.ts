import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  plannedEmail: {
    count: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const resendSendMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/server/config', () => ({
  config: {
    RESEND_FROM_EMAIL: 'YumCut <hello@app.yumcut.com>',
    NEXTAUTH_SECRET: 'test-secret-for-reply-bonus',
  },
}));

vi.mock('@/server/emails/resend', () => ({
  getResendClient: () => ({
    emails: {
      send: resendSendMock,
    },
  }),
}));

import {
  buildReplyBonusReplyToAddress,
  parseReplyBonusReplyToAddress,
  processPlannedEmails,
  queueUserOnboardingEmails,
} from '@/server/emails/planned';

function mockClaimedEmails(claimed: Array<{
  id: string;
  userId: string;
  email: string;
  kind: string;
  attempts: number;
  targetLanguage: string;
  user: { preferredLanguage: string; name: string | null } | null;
}>) {
  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    const tx = {
      plannedEmail: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(claimed.map((item) => ({ id: item.id })))
          .mockResolvedValueOnce(claimed),
        updateMany: vi.fn().mockResolvedValue({ count: claimed.length }),
      },
    };
    return callback(tx);
  });
}

describe('planned emails localization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ preferredLanguage: 'en' });
    prismaMock.plannedEmail.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prismaMock.plannedEmail.createMany.mockResolvedValue({ count: 2 });
    prismaMock.plannedEmail.updateMany.mockResolvedValue({ count: 1 });
    resendSendMock.mockResolvedValue({ data: { id: 're_test_1' } });
  });

  it('stores targetLanguage when queueing onboarding emails', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ preferredLanguage: 'ru-RU' });

    const queued = await queueUserOnboardingEmails({
      userId: 'user-1',
      email: 'user@example.com',
      name: 'Ivan',
    });

    expect(queued).toBe(true);
    expect(prismaMock.plannedEmail.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ kind: 'welcome_v1', targetLanguage: 'ru' }),
          expect.objectContaining({ kind: 'follow_up_24h_v1', targetLanguage: 'ru' }),
        ]),
      }),
    );
  });

  it('builds and verifies signed reply bonus aliases', () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const alias = buildReplyBonusReplyToAddress(userId);
    expect(alias).toMatch(/^rb\+11111111-1111-1111-1111-111111111111\.[a-f0-9]{16}@app\.yumcut\.com$/);
    const localPart = alias!.split('@')[0] ?? '';
    expect(localPart.length).toBeLessThanOrEqual(64);
    expect(parseReplyBonusReplyToAddress([alias!])).toEqual({ userId });
    const legacyAlias = alias!.replace(/^rb\+/, 'reply-bonus+');
    expect(parseReplyBonusReplyToAddress([legacyAlias])).toEqual({ userId });
    expect(parseReplyBonusReplyToAddress(['reply-bonus+11111111-1111-1111-1111-111111111111.deadbeefdeadbeef@app.yumcut.com'])).toBeNull();
  });

  it('uses russian template when user language is ru before send', async () => {
    mockClaimedEmails([
      {
        id: 'planned-1',
        userId: 'user-1',
        email: 'user@example.com',
        kind: 'welcome_v1',
        attempts: 0,
        targetLanguage: 'en',
        user: { preferredLanguage: 'ru', name: 'Иван' },
      },
    ]);

    const result = await processPlannedEmails({ limit: 10 });

    expect(result).toEqual({
      plannedDue: 1,
      plannedPending: 1,
      claimed: 1,
      sent: 1,
      rescheduled: 0,
      failed: 0,
      skipped: 0,
    });

    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'личное сообщение для Иван',
        text: expect.stringContaining('здравствуйте, Иван!'),
        replyTo: [expect.stringMatching(/^rb\+user-1\.[a-f0-9]{16}@app\.yumcut\.com$/)],
      }),
    );

    expect(prismaMock.plannedEmail.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'sent',
          targetLanguage: 'ru',
        }),
      }),
    );
  });

  it('falls back to english template when language template is missing', async () => {
    mockClaimedEmails([
      {
        id: 'planned-2',
        userId: 'user-2',
        email: 'user@example.com',
        kind: 'welcome_v1',
        attempts: 0,
        targetLanguage: 'de',
        user: { preferredLanguage: 'de-DE', name: 'Max' },
      },
    ]);

    await processPlannedEmails({ limit: 10 });

    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'personal message for Max',
        text: expect.stringMatching(/hey Max,[\s\S]*30 tokens/i),
      }),
    );

    expect(prismaMock.plannedEmail.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'sent',
          targetLanguage: 'en',
        }),
      }),
    );
  });
});
