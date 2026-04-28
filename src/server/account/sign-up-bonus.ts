// Grant free users unlimited tokens on signup
await grantTokens({
  userId: newUser.id,
  amount: 999999,
  type: 'system_grant',
  description: 'Free tier unlimited tokens',
});
