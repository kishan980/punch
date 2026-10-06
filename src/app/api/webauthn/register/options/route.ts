import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { getWebAuthnConfig } from "@/lib/webauthn/config";
import { setRegistrationChallenge } from "@/lib/webauthn/helpers";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, member_code")
      .eq("auth_user_id", user.id)
      .single();

    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer") ||
      undefined;
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      undefined;
    const { rpId, rpName } = getWebAuthnConfig(origin, host);

    // Fetch existing credentials to exclude already registered authenticators
    const { data: existingCredentials } = await supabase
      .from("webauthn_credentials")
      .select("credential_id")
      .eq("user_id", user.id);

    // Allow re-registration anytime without authenticator duplicate exclusion blocks
    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userID: new TextEncoder().encode(user.id),
      userName: user.email || profile?.member_code || "Gym Member",
      userDisplayName: profile?.full_name || "Gym Member",
      attestationType: "none",
      excludeCredentials: [], // Allows re-registration and multiple biometric enrollments
      supportedAlgorithmIDs: [-7, -257], // ES256 & RS256 - required for Android/OnePlus hardware keystore & Apple Secure Enclave
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Native device sensor (Face ID / Face Unlock / Fingerprint)
        residentKey: "preferred",
        userVerification: "preferred", // 'preferred' allows iPhone Face ID, Android Face Unlock & Fingerprint without strict blocking
      },
    });

    // Store challenge in httpOnly cookie
    await setRegistrationChallenge(options.challenge);

    return NextResponse.json(options);
  } catch (error: unknown) {
    console.error("Error generating registration options:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
