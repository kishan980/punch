import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { getWebAuthnConfig } from "@/lib/webauthn/config";
import { setAuthenticationChallenge } from "@/lib/webauthn/helpers";

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

    // Fetch user's registered WebAuthn credentials
    const { data: credentials, error: credError } = await supabase
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", user.id);

    if (credError) {
      return NextResponse.json(
        { error: "Database error fetching credentials." },
        { status: 500 }
      );
    }

    if (!credentials || credentials.length === 0) {
      return NextResponse.json(
        { error: "Please register this phone first." },
        { status: 404 }
      );
    }

    const origin = request.headers.get("origin") || undefined;
    const host = request.headers.get("host") || undefined;
    const { rpId } = getWebAuthnConfig(origin, host);

    const allowCredentials = credentials.map((cred) => ({
      id: cred.credential_id,
      transports: (cred.transports || ["internal"]) as any,
    }));

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials,
      userVerification: "preferred",
    });

    // Store challenge in httpOnly cookie
    await setAuthenticationChallenge(options.challenge);

    return NextResponse.json(options);
  } catch (error: unknown) {
    console.error("Error generating authentication options:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
