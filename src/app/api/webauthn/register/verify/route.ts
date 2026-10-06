import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { getWebAuthnConfig } from "@/lib/webauthn/config";
import {
  getRegistrationChallenge,
  clearRegistrationChallenge,
  uint8ArrayToBase64Url,
} from "@/lib/webauthn/helpers";

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

    const expectedChallenge = await getRegistrationChallenge();
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Registration challenge expired or missing. Please try again." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const origin = request.headers.get("origin") || undefined;
    const host = request.headers.get("host") || undefined;
    const { rpId, expectedOrigin } = getWebAuthnConfig(origin, host);

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpId,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Biometric verification failed." },
        { status: 400 }
      );
    }

    const { registrationInfo } = verification;

    // Handle credential properties across simplewebauthn version structures
    const credentialId =
      registrationInfo.credential?.id ||
      (registrationInfo as unknown as { credentialID?: string }).credentialID;

    const credentialPublicKeyBytes =
      registrationInfo.credential?.publicKey ||
      (registrationInfo as unknown as { credentialPublicKey?: Uint8Array }).credentialPublicKey;

    const counter =
      registrationInfo.credential?.counter ??
      (registrationInfo as unknown as { counter?: number }).counter ??
      0;

    const transports =
      body.response?.transports ||
      registrationInfo.credential?.transports ||
      ["internal"];

    if (!credentialId || !credentialPublicKeyBytes) {
      return NextResponse.json(
        { error: "Invalid credential data returned by authenticator." },
        { status: 400 }
      );
    }

    // Convert Uint8Array public key to safe base64url string
    const publicKeyBase64 = uint8ArrayToBase64Url(credentialPublicKeyBytes);

    // Save credential in Supabase webauthn_credentials table
    const { error: insertError } = await supabase
      .from("webauthn_credentials")
      .upsert(
        {
          user_id: user.id,
          credential_id: credentialId,
          public_key: publicKeyBase64,
          counter: counter,
          transports: transports,
        },
        { onConflict: "credential_id" }
      );

    if (insertError) {
      console.error("Database insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save biometric credential." },
        { status: 500 }
      );
    }

    // Clean up stored challenge
    await clearRegistrationChallenge();

    return NextResponse.json({
      success: true,
      message: "Biometric registered successfully ✅",
    });
  } catch (error: unknown) {
    console.error("Error verifying registration:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
