/**
 * WebAuthn / Passkey Relying Party configuration
 * Dynamically resolves domain and expected origin for seamless mobile and production testing
 */

export function getWebAuthnConfig(requestOrigin?: string, requestHost?: string) {
  let hostname = "localhost";
  let detectedOrigin = "http://localhost:3000";

  if (requestOrigin) {
    try {
      const url = new URL(requestOrigin);
      hostname = url.hostname;
      detectedOrigin = url.origin;
    } catch {
      // Fallback
    }
  } else if (requestHost) {
    hostname = requestHost.split(":")[0];
    detectedOrigin = `https://${hostname}`;
  }

  // RP ID must match the current domain of the page
  let rpId = hostname;
  if (process.env.RP_ID && process.env.RP_ID !== "localhost") {
    rpId = process.env.RP_ID;
  }

  const rpName = process.env.RP_NAME || "Gym Punch Demo";

  // Build a list of valid expected origins.
  // ALWAYS include the live origin detected from the incoming browser request.
  const originsList = new Set<string>();

  if (detectedOrigin) {
    originsList.add(detectedOrigin);
  }

  if (requestOrigin) {
    try {
      originsList.add(new URL(requestOrigin).origin);
    } catch {}
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      originsList.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    } catch {}
  }

  // Common fallbacks
  originsList.add("https://punch-two-chi.vercel.app");
  originsList.add("http://localhost:3000");

  const expectedOrigin = Array.from(originsList);

  return {
    rpId,
    rpName,
    expectedOrigin,
  };
}
