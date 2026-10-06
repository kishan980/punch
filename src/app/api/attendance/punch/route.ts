import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndClearBiometricReceipt } from "@/lib/webauthn/helpers";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // 1. Check authenticated Supabase user
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { punchType } = body;

    if (punchType !== "in" && punchType !== "out") {
      return NextResponse.json(
        { error: "Invalid punch type. Allowed: 'in' or 'out'." },
        { status: 400 }
      );
    }

    // 2. Find profile with auto-provisioning
    let { data: profile } = await supabase
      .from("profiles")
      .select("id, status, member_code, full_name")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile) {
      try {
        const adminClient = createAdminClient();
        const defaultCode = `GYM-${Math.floor(1000 + Math.random() * 9000)}`;
        const { data: newProfile } = await adminClient
          .from("profiles")
          .upsert(
            {
              auth_user_id: user.id,
              full_name: user.email?.split("@")[0] || "Gym Member",
              member_code: defaultCode,
              role: "member",
              status: "active",
            },
            { onConflict: "auth_user_id" }
          )
          .select("id, status, member_code, full_name")
          .single();

        if (newProfile) {
          profile = newProfile;
        }
      } catch (err) {
        console.error("Profile auto-provisioning error:", err);
      }
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Member profile not found." },
        { status: 404 }
      );
    }

    // 3. Check member status
    if (profile.status !== "active") {
      return NextResponse.json(
        { error: "Membership is inactive. Please contact gym administrator." },
        { status: 403 }
      );
    }

    // 4. Cryptographic WebAuthn Verification check
    // The server verifies that biometric authentication succeeded in the last 60 seconds
    const receiptValid = await verifyAndClearBiometricReceipt(user.id);
    if (!receiptValid) {
      return NextResponse.json(
        {
          error: "Biometric verification failed or expired. Please authenticate again.",
        },
        { status: 403 }
      );
    }

    // 5. Check today's punch status
    const now = new Date();
    // Midnight start of current day in UTC
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { data: todayPunches, error: punchesError } = await supabase
      .from("attendance")
      .select("punch_type, punch_time")
      .eq("user_id", user.id)
      .gte("punch_time", startOfDay)
      .order("punch_time", { ascending: true });

    if (punchesError) {
      console.error("Error checking attendance history:", punchesError);
      return NextResponse.json(
        { error: "Unable to record attendance. Please try again." },
        { status: 500 }
      );
    }

    const latestPunch = todayPunches && todayPunches.length > 0
      ? todayPunches[todayPunches.length - 1]
      : null;

    // 6. Prevent duplicate punch & validate IN/OUT state machine
    if (punchType === "in") {
      if (latestPunch && latestPunch.punch_type === "in") {
        return NextResponse.json(
          {
            success: false,
            message: "You have already punched in.",
            error: "You have already punched in.",
          },
          { status: 400 }
        );
      }
    } else if (punchType === "out") {
      if (!latestPunch || latestPunch.punch_type !== "in") {
        return NextResponse.json(
          {
            success: false,
            message: "Cannot punch out before punching in.",
            error: "Cannot punch out before punching in.",
          },
          { status: 400 }
        );
      }
    }

    // 7. Insert attendance
    const punchTime = now.toISOString();
    const { error: insertError } = await supabase.from("attendance").insert({
      user_id: user.id,
      member_id: profile.id,
      punch_type: punchType,
      punch_time: punchTime,
      method: "mobile_biometric", // Preserves structured future machine compatibility
    });

    if (insertError) {
      console.error("Error inserting attendance record:", insertError);
      return NextResponse.json(
        { error: "Unable to record attendance. Please try again." },
        { status: 500 }
      );
    }

    // 8. Return success
    return NextResponse.json({
      success: true,
      message: punchType === "in" ? "Punch in successful" : "Punch out successful",
      punchType,
      punchTime,
    });
  } catch (error: unknown) {
    console.error("Server error during punch recording:", error);
    const msg = error instanceof Error ? error.message : "Unable to record attendance. Please try again.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
