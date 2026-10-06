import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { getWebAuthnConfig } from "@/lib/webauthn/config";
import {
  getAuthenticationChallenge,
  clearAuthenticationChallenge,
  base64UrlToUint8Array,
  setBiometricVerifiedReceipt,
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

    const expectedChallenge = await getAuthenticationChallenge();
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Authentication challenge expired. Please retry." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const credentialId = body?.id;

    if (!credentialId) {
      return NextResponse.json(
        { error: "Missing credential ID in authentication response." },
        { status: 400 }
      );
    }

    // Retrieve the registered credential from database and verify it belongs to this user
    const { data: credentialRecord, error: credError } = await supabase
      .from("webauthn_credentials")
      .select("*")
      .eq("credential_id", credentialId)
      .eq("user_id", user.id)
      .single();

    if (credError || !credentialRecord) {
      return NextResponse.json(
        { error: "Credential not registered or does not belong to this user." },
        { status: 403 }
      );
    }

    const origin = request.headers.get("origin") || undefined;
    const host = request.headers.get("host") || undefined;
    const { rpId, expectedOrigin } = getWebAuthnConfig(origin, host);

    const credentialPublicKeyBytes = base64UrlToUint8Array(credentialRecord.public_key);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpId,
      credential: {
        id: credentialRecord.credential_id,
        publicKey: credentialPublicKeyBytes,
        counter: Number(credentialRecord.counter),
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Biometric verification failed." },
        { status: 400 }
      );
    }

    // Update credential counter in database to prevent replay attacks
    const newCounter = verification.authenticationInfo.newCounter;
    await supabase
      .from("webauthn_credentials")
      .update({ counter: newCounter })
      .eq("id", credentialRecord.id);

    // Clear challenge and set short-lived server verification receipt
    await clearAuthenticationChallenge();
    await setBiometricVerifiedReceipt(user.id, credentialId);

    return NextResponse.json({
      success: true,
      message: "Biometric verification successful",
      credentialId,
    });
  } catch (error: unknown) {
    console.error("Error verifying authentication:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
