import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndClearBiometricReceipt } from "@/lib/webauthn/helpers";
import { getLocationConfig, calculateDistanceMeters } from "@/lib/location";

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
    const { punchType, latitude, longitude } = body;

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

    // 4. GPS Geofence Check (Office Area verification)
    const locationConfig = await getLocationConfig();
    let distanceMeters: number | null = null;

    if (locationConfig.isEnabled) {
      if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
        return NextResponse.json(
          {
            error: "Office GPS location is required to punch. Please turn on location services on your device.",
          },
          { status: 403 }
        );
      }

      const memberLat = Number(latitude);
      const memberLon = Number(longitude);

      if (isNaN(memberLat) || isNaN(memberLon)) {
        return NextResponse.json(
          { error: "Invalid GPS coordinates received from device." },
          { status: 400 }
        );
      }

      distanceMeters = calculateDistanceMeters(
        memberLat,
        memberLon,
        locationConfig.latitude,
        locationConfig.longitude
      );

      if (distanceMeters > locationConfig.radiusMeters) {
        return NextResponse.json(
          {
            error: `Aap office area se bahar hain (${distanceMeters}m door, Allowed: ${locationConfig.radiusMeters}m). Punch sirf office ke andar se allow hai.`,
            distance: distanceMeters,
            allowedRadius: locationConfig.radiusMeters,
          },
          { status: 403 }
        );
      }
    }

    // 5. Cryptographic WebAuthn Verification check
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

    // 6. Check today's punch status
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

    // 7. Prevent duplicate punch & validate IN/OUT state machine
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

    // 8. Insert attendance record
    const punchTime = now.toISOString();
    const attendancePayload: Record<string, unknown> = {
      user_id: user.id,
      member_id: profile.id,
      punch_type: punchType,
      punch_time: punchTime,
      method: "mobile_biometric", // Preserves structured future machine compatibility
    };

    if (latitude !== undefined && longitude !== undefined) {
      attendancePayload.latitude = Number(latitude);
      attendancePayload.longitude = Number(longitude);
    }

    let { error: insertError } = await supabase.from("attendance").insert(attendancePayload);

    // If column doesn't exist yet in Supabase schema, retry without latitude/longitude
    if (insertError && (insertError.message?.includes("column") || insertError.message?.includes("latitude"))) {
      delete attendancePayload.latitude;
      delete attendancePayload.longitude;
      const retry = await supabase.from("attendance").insert(attendancePayload);
      insertError = retry.error;
    }

    if (insertError) {
      console.error("Error inserting attendance record:", insertError);
      return NextResponse.json(
        { error: "Unable to record attendance. Please try again." },
        { status: 500 }
      );
    }

    // 9. Return success
    return NextResponse.json({
      success: true,
      message: punchType === "in" ? "Punch in successful" : "Punch out successful",
      punchType,
      punchTime,
      distance: distanceMeters,
    });
  } catch (error: unknown) {
    console.error("Server error during punch recording:", error);
    const msg = error instanceof Error ? error.message : "Unable to record attendance. Please try again.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
