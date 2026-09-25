import { flag } from "@/lib/relay-server";

// Client-safe settings the app reads at startup. Values come from private server env vars.
export async function GET() {
  return Response.json({ sponsorGas: flag("SPONSOR_GAS", false) });
}
