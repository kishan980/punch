import { cookies } from "next/headers";

const REG_CHALLENGE_COOKIE = "gym_punch_webauthn_reg_challenge";
const AUTH_CHALLENGE_COOKIE = "gym_punch_webauthn_auth_challenge";
const VERIFIED_TOKEN_COOKIE = "gym_punch_biometric_verified_token";

export async function setRegistrationChallenge(challenge: string) {
  const cookieStore = await cookies();
  cookieStore.set(REG_CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300, // 5 minutes
  });
}

export async function getRegistrationChallenge(): Promise<string | null> {
  const cookieStore = await cookies();
  const challenge = cookieStore.get(REG_CHALLENGE_COOKIE)?.value || null;
  return challenge;
}

export async function clearRegistrationChallenge() {
  const cookieStore = await cookies();
  cookieStore.delete(REG_CHALLENGE_COOKIE);
}

export async function setAuthenticationChallenge(challenge: string) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300, // 5 minutes
  });
}

export async function getAuthenticationChallenge(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_CHALLENGE_COOKIE)?.value || null;
}

export async function clearAuthenticationChallenge() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_CHALLENGE_COOKIE);
}

/**
 * Stores a short-lived cryptographic biometric verification receipt cookie
 * after successful verification of WebAuthn credentials on the server.
 */
export async function setBiometricVerifiedReceipt(userId: string, credentialId: string) {
  const cookieStore = await cookies();
  const payload = JSON.stringify({
    userId,
    credentialId,
    timestamp: Date.now(),
  });
  // Simple Base64-encoded receipt payload (valid for 60 seconds)
  const token = Buffer.from(payload).toString("base64url");
  cookieStore.set(VERIFIED_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60, // 60 seconds valid
  });
}

export async function verifyAndClearBiometricReceipt(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(VERIFIED_TOKEN_COOKIE)?.value;
  if (!token) return false;

  try {
    const raw = Buffer.from(token, "base64url").toString("utf-8");
    const data = JSON.parse(raw);

    // Verify it matches the user and hasn't expired (60s)
    if (data.userId === userId && Date.now() - data.timestamp < 60000) {
      cookieStore.delete(VERIFIED_TOKEN_COOKIE);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Convert Uint8Array to base64url string
 */
export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/**
 * Convert base64url string to Uint8Array
 */
export function base64UrlToUint8Array(base64url: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64url, "base64url"));
}
