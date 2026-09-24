import "server-only";

export const RELAY_API = "https://api.relay.link";

export function relayHeaders(): Record<string, string> | null {
  const apiKey = process.env.RELAY_API_KEY;
  return apiKey ? { "Content-Type": "application/json", "x-api-key": apiKey } : null;
}

export const missingKey = () =>
  Response.json({ message: "RELAY_API_KEY is not set. Add it to .env.local." }, { status: 500 });

// Only these Relay endpoints are reachable through the /api/relay proxy,
// so the API key can't be used for anything else from the browser.
const ALLOWED = [
  /^chains$/,
  /^currencies\/token\/price$/,
  /^execute$/,
  /^execute\/permits$/,
  /^intents\/status\/v3$/,
  /^requests\/v3$/,
  /^transactions\/index$/,
];

export const isAllowedPath = (path: string) => ALLOWED.some((re) => re.test(path));

export const flag = (name: string, fallback: boolean) => {
  const v = process.env[name];
  return v === undefined ? fallback : v === "true";
};
