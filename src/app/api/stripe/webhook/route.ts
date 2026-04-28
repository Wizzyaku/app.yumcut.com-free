export async function POST(req: NextRequest) {
  // FREE MODE: Webhooks disabled
  return ok({ received: true });
}
