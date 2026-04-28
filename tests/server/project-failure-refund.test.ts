import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ProjectStatus } from '@/shared/constants/status';

const projectFindUnique = vi.hoisted(() => vi.fn());
const imageAssetFindMany = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const projectUpdate = vi.hoisted(() => vi.fn());
const statusHistoryCreate = vi.hoisted(() => vi.fn());
const tokenTransactionFindMany = vi.hoisted(() => vi.fn());
const tokenTransactionCreate = vi.hoisted(() => vi.fn());
const userFindUnique = vi.hoisted(() => vi.fn());
const userUpdate = vi.hoisted(() => vi.fn());
const assertDaemonAuth = vi.hoisted(() => vi.fn());
const notifyProjectStatusChange = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({
  prisma: {
    project: {
      findUnique: projectFindUnique,
      update: projectUpdate,
    },
    imageAsset: {
      findMany: imageAssetFindMany,
    },
    $transaction: transaction,
  },
}));

vi.mock('@/server/auth', () => ({
  assertDaemonAuth,
}));

vi.mock('@/server/telegram', () => ({
  notifyProjectStatusChange,
}));

function makeRequest(projectId: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/daemon/projects/${projectId}/status`, {
    method: 'POST',
    headers: new Headers({ 'content-type': 'application/json' }),
    body: JSON.stringify(body),
  });
}

describe('daemon status token refunds on project failure', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    assertDaemonAuth.mockResolvedValue('daemon-1');
    projectFindUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      currentDaemonId: 'daemon-1',
      languages: ['en'],
    });
    imageAssetFindMany.mockResolvedValue([]);
    projectUpdate.mockResolvedValue({});
    statusHistoryCreate.mockResolvedValue({});
    userUpdate.mockResolvedValue({});
    notifyProjectStatusChange.mockResolvedValue(undefined);
    transaction.mockImplementation(async (callback: any) => callback({
      project: { update: projectUpdate },
      audioCandidate: { updateMany: vi.fn(), findUnique: vi.fn() },
      script: { findUnique: vi.fn() },
      projectTemplateImage: {},
      projectStatusHistory: { create: statusHistoryCreate },
      tokenTransaction: {
        findMany: tokenTransactionFindMany,
        create: tokenTransactionCreate,
      },
      user: {
        findUnique: userFindUnique,
        update: userUpdate,
      },
    }));
  });

  it('refunds net spent tokens when a project moves to error', async () => {
    tokenTransactionFindMany.mockResolvedValue([
      { delta: -150, metadata: { projectId: 'project-1' } },
      { delta: 40, metadata: { projectId: 'project-1' } },
      { delta: -70, metadata: { projectId: 'other-project' } },
    ]);
    userFindUnique.mockResolvedValue({ tokenBalance: 20 });

    const route = await import('@/app/api/daemon/projects/[projectId]/status/route');
    const req = makeRequest('project-1', {
      status: ProjectStatus.Error,
      message: 'Video parts rendering failed',
    });

    const res = await route.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) });
    expect(res.status).toBe(200);

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { tokenBalance: 130 },
    });
    expect(tokenTransactionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        delta: 110,
        balanceAfter: 130,
        type: 'PROJECT_FAILURE_REFUND',
        description: 'Project failed refund',
        metadata: { projectId: 'project-1' },
      }),
    }));
    expect(statusHistoryCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: ProjectStatus.Error,
        message: expect.stringContaining('Refunded 110 tokens'),
      }),
    }));
  });

  it('does not double refund if ledger is already balanced for the project', async () => {
    tokenTransactionFindMany.mockResolvedValue([
      { delta: -100, metadata: { projectId: 'project-1' } },
      { delta: 100, metadata: { projectId: 'project-1' } },
    ]);

    const route = await import('@/app/api/daemon/projects/[projectId]/status/route');
    const req = makeRequest('project-1', {
      status: ProjectStatus.Error,
      message: 'Video parts rendering failed',
    });

    const res = await route.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) });
    expect(res.status).toBe(200);

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(tokenTransactionCreate).not.toHaveBeenCalled();
    expect(statusHistoryCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: ProjectStatus.Error,
        message: 'Video parts rendering failed',
      }),
    }));
  });
});

