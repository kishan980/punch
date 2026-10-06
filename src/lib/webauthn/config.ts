/**
 * WebAuthn / Passkey Relying Party configuration
 * Dynamically resolves domain for seamless mobile testing over tunnels or local network
 */

export function getWebAuthnConfig(requestOrigin?: string, requestHost?: string) {
  let hostname = "localhost";
  let origin = "http://localhost:3000";

  if (requestOrigin) {
    try {
      const url = new URL(requestOrigin);
      hostname = url.hostname;
      origin = url.origin;
    } catch {
      // Fallback
    }
  } else if (requestHost) {
    hostname = requestHost.split(":")[0];
    origin = `http://${requestHost}`;
  }

  // If request comes from a real domain/tunnel/mobile (not localhost),
  // automatically adopt that domain so mobile WebAuthn matches the phone's address bar!
  let rpId = process.env.RP_ID;
  if (!rpId || rpId === "localhost") {
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      rpId = hostname;
    } else {
      rpId = "localhost";
    }
  }

  const rpName = process.env.RP_NAME || "Gym Punch Demo";
  const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL || origin;

  return {
    rpId,
    rpName,
    expectedOrigin,
  };
}
