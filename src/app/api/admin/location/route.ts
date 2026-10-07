import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLocationConfig, saveLocationConfig } from "@/lib/location";

export async function GET() {
  try {
    const config = await getLocationConfig();
    return NextResponse.json(config);
  } catch (error: unknown) {
    console.error("Error reading gym location config:", error);
    const msg = error instanceof Error ? error.message : "Error reading location config";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

    // Verify admin
    const isAdminEmail = Boolean(
      user.email?.toLowerCase().includes("admin") ||
      user.email?.toLowerCase().includes("owner") ||
      user.email?.toLowerCase().includes("manager")
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    if (!isAdminEmail && profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { latitude, longitude, radiusMeters, isEnabled, officeName } = body;

    if (latitude !== undefined && (isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) {
      return NextResponse.json({ error: "Invalid latitude (-90 to 90)" }, { status: 400 });
    }

    if (longitude !== undefined && (isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) {
      return NextResponse.json({ error: "Invalid longitude (-180 to 180)" }, { status: 400 });
    }

    if (radiusMeters !== undefined && (isNaN(Number(radiusMeters)) || Number(radiusMeters) <= 0)) {
      return NextResponse.json({ error: "Radius must be a positive number of meters" }, { status: 400 });
    }

    const updated = await saveLocationConfig({
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      radiusMeters: radiusMeters !== undefined ? Number(radiusMeters) : undefined,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : undefined,
      officeName: officeName !== undefined ? String(officeName) : undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Office GPS location settings updated successfully",
      config: updated,
    });
  } catch (error: unknown) {
    console.error("Error updating gym location config:", error);
    const msg = error instanceof Error ? error.message : "Error updating location config";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
