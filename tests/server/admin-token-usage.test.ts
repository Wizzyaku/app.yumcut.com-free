import { describe, expect, it } from 'vitest';
import { extractProjectIdFromTokenMetadata, toUsedTokensFromDelta } from '@/server/admin/token-usage';

describe('admin token usage helpers', () => {
  it('extracts projectId from metadata object', () => {
    expect(extractProjectIdFromTokenMetadata({ projectId: 'project-1' })).toBe('project-1');
    expect(extractProjectIdFromTokenMetadata({ projectId: '  project-2  ' })).toBe('project-2');
    expect(extractProjectIdFromTokenMetadata({})).toBeNull();
    expect(extractProjectIdFromTokenMetadata(null)).toBeNull();
    expect(extractProjectIdFromTokenMetadata('raw')).toBeNull();
  });

  it('converts delta sums to used token count', () => {
    expect(toUsedTokensFromDelta(-50)).toBe(50);
    expect(toUsedTokensFromDelta(0)).toBe(0);
    expect(toUsedTokensFromDelta(10)).toBe(0);
    expect(toUsedTokensFromDelta(null)).toBe(0);
  });
});

