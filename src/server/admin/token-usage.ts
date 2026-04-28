import { TOKEN_TRANSACTION_TYPES } from '@/shared/constants/token-costs';

export const PROJECT_RELATED_TOKEN_TYPES = [
  TOKEN_TRANSACTION_TYPES.projectCreation,
  TOKEN_TRANSACTION_TYPES.scriptRevision,
  TOKEN_TRANSACTION_TYPES.audioRegeneration,
  TOKEN_TRANSACTION_TYPES.imageRegeneration,
  TOKEN_TRANSACTION_TYPES.imageRegenerationRefund,
  TOKEN_TRANSACTION_TYPES.projectFailureRefund,
] as const;

export const PROJECT_ACTION_TOKEN_TYPES = [
  TOKEN_TRANSACTION_TYPES.scriptRevision,
  TOKEN_TRANSACTION_TYPES.audioRegeneration,
  TOKEN_TRANSACTION_TYPES.imageRegeneration,
  TOKEN_TRANSACTION_TYPES.imageRegenerationRefund,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractProjectIdFromTokenMetadata(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  const raw = metadata.projectId;
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

export function toUsedTokensFromDelta(sumDelta: number | null | undefined): number {
  const normalized = typeof sumDelta === 'number' && Number.isFinite(sumDelta) ? sumDelta : 0;
  return Math.max(0, -normalized);
}
