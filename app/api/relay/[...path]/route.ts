import { missingKey, isAllowedPath, relayHeaders, RELAY_API } from "@/lib/relay-server";

type Ctx = { params: Promise<{ path: string[] }> };

// The Relay SDK in the browser points its baseApiUrl here. The proxy adds the
// API key server-side and only forwards an allowlisted set of endpoints.
async function forward(request: Request, { params }: Ctx) {
  const path = (await params).path.join("/");
  if (!isAllowedPath(path)) {
    return Response.json({ message: `Endpoint not allowed: ${path}` }, { status: 404 });
  }

  const headers = relayHeaders();
  if (!headers) return missingKey();

  const { search } = new URL(request.url);
  const res = await fetch(`${RELAY_API}/${path}${search}`, {
    method: request.method,
    headers,
    body: request.method === "GET" ? undefined : await request.text(),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export { forward as GET, forward as POST };
