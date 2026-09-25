import { flag } from "@/lib/relay-server";

// Client-safe settings the app reads at startup. Values come from private server env vars.
export async function GET() {
  return Response.json({
    sponsorGas: flag("SPONSOR_GAS", false),
    // How long a deposit can go unindexed before the app asks the backend for a fast fill
    fastFillAfterSeconds: Number(process.env.FAST_FILL_AFTER_SECONDS ?? 10),
  });
}
