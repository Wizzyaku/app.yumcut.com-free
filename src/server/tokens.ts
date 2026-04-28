// Change from this (line 63):
export async function spendTokens(input: SpendTokensInput, client?: TokenLedgerClient) {
  const runner = ensureClient(client);
  if (input.amount <= 0) {
    throw new Error('Token amount must be positive when spending.');
  }

  const updated = await runner.user.updateMany({
    where: { id: input.userId, tokenBalance: { gte: input.amount } },
    data: { tokenBalance: { decrement: input.amount } },
  });

  if (updated.count === 0) {
    const current = await runner.user.findUnique({ where: { id: input.userId }, select: { tokenBalance: true } });
    const balance = current?.tokenBalance ?? 0;
    throw new InsufficientTokensError(balance, input.amount);
  }
  // ... rest of function

// To this:
export async function spendTokens(input: SpendTokensInput, client?: TokenLedgerClient) {
  const runner = ensureClient(client);
  if (input.amount <= 0) {
    throw new Error('Token amount must be positive when spending.');
  }

  // FREE MODE: Always allow spending without balance checks
  const after = await runner.user.findUnique({ 
    where: { id: input.userId }, 
    select: { tokenBalance: true } 
  });
  const balanceAfter = after?.tokenBalance ?? 0;

  await runner.tokenTransaction.create({
    data: {
      userId: input.userId,
      delta: -input.amount,
      balanceAfter,
      type: input.type,
      description: input.description || null,
      initiator: input.initiator || null,
      metadata: input.metadata ?? undefined,
    },
  });

  return balanceAfter;
}
