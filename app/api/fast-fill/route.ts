import { missingKey, flag, relayHeaders, RELAY_API } from "@/lib/relay-server";

// Optional: fast fill right after the deposit is submitted. Draws on your app
// balance, so it's off unless FAST_FILL=true.
export async function POST(request: Request) {
  if (!flag("FAST_FILL", false)) {
    return Response.json({ skipped: true, reason: "FAST_FILL is not enabled" });
  }

  const { requestId } = (await request.json()) as { requestId?: string };
  if (!requestId || !/^0x[a-fA-F0-9]{64}$/.test(requestId)) {
    return Response.json({ message: "Invalid requestId" }, { status: 400 });
  }

  const headers = relayHeaders();
  if (!headers) return missingKey();

  const res = await fetch(`${RELAY_API}/fast-fill`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      requestId,
      maxFillAmountUsd: Number(process.env.FAST_FILL_MAX_USD ?? 50),
    }),
  });

  // A 409 means the request is already being processed. Treat it as done.
  if (res.status === 409) return Response.json({ alreadyProcessing: true });
  return Response.json(await res.json(), { status: res.status });
}
