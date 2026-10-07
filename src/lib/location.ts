import { createAdminClient } from "@/lib/supabase/admin";
import {
  type GymLocationConfig,
  DEFAULT_LOCATION_CONFIG,
  calculateDistanceMeters,
} from "@/lib/geo";

export { type GymLocationConfig, DEFAULT_LOCATION_CONFIG, calculateDistanceMeters };

// Global fallback in memory across requests in Node.js runtime
declare global {
  // eslint-disable-next-line no-var
  var __gym_location_cache: GymLocationConfig | undefined;
}

/**
 * Retrieves the current configured office location.
 * Checks Supabase gym_location_settings first, then profiles fallback, then memory/default.
 */
export async function getLocationConfig(): Promise<GymLocationConfig> {
  // 1. Try dedicated gym_location_settings table
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("gym_location_settings")
      .select("*")
      .eq("id", "default")
      .single();

    if (!error && data && data.latitude !== undefined) {
      const cfg: GymLocationConfig = {
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        radiusMeters: Number(data.radius_meters) || 100,
        isEnabled: data.is_enabled ?? true,
        officeName: data.office_name || "Main Gym / Office",
      };
      globalThis.__gym_location_cache = cfg;
      return cfg;
    }
  } catch (err) {
    console.warn("gym_location_settings query failed, trying profiles fallback:", err);
  }

  // 2. Fallback: check profiles table for 'GYM_OFFICE_CONFIG' record
  try {
    const admin = createAdminClient();
    const { data: profileRecord } = await admin
      .from("profiles")
      .select("phone")
      .eq("member_code", "GYM_OFFICE_CONFIG")
      .single();

    if (profileRecord?.phone) {
      const parsed = JSON.parse(profileRecord.phone);
      if (parsed && typeof parsed.latitude === "number") {
        globalThis.__gym_location_cache = parsed;
        return parsed;
      }
    }
  } catch {}

  // 3. Fallback to in-memory cache or default
  return globalThis.__gym_location_cache || DEFAULT_LOCATION_CONFIG;
}

/**
 * Saves/updates office location settings.
 * Persists to Supabase gym_location_settings AND profiles fallback, and in-memory cache.
 */
export async function saveLocationConfig(
  newConfig: Partial<GymLocationConfig>
): Promise<GymLocationConfig> {
  const current = await getLocationConfig();
  const merged: GymLocationConfig = {
    latitude: newConfig.latitude !== undefined ? Number(newConfig.latitude) : current.latitude,
    longitude: newConfig.longitude !== undefined ? Number(newConfig.longitude) : current.longitude,
    radiusMeters: newConfig.radiusMeters !== undefined ? Number(newConfig.radiusMeters) : current.radiusMeters,
    isEnabled: newConfig.isEnabled !== undefined ? Boolean(newConfig.isEnabled) : current.isEnabled,
    officeName: newConfig.officeName || current.officeName,
  };

  globalThis.__gym_location_cache = merged;

  const admin = createAdminClient();

  // 1. Try persisting to gym_location_settings table
  try {
    await admin
      .from("gym_location_settings")
      .upsert({
        id: "default",
        latitude: merged.latitude,
        longitude: merged.longitude,
        radius_meters: merged.radiusMeters,
        is_enabled: merged.isEnabled,
        office_name: merged.officeName,
        updated_at: new Date().toISOString(),
      });
  } catch (err) {
    console.warn("gym_location_settings upsert failed:", err);
  }

  // 2. Also persist to profiles table fallback so it is 100% resilient across Vercel lambdas
  try {
    await admin.from("profiles").upsert(
      {
        member_code: "GYM_OFFICE_CONFIG",
        full_name: "Office GPS Config",
        phone: JSON.stringify(merged),
        role: "admin",
        status: "active",
      },
      { onConflict: "member_code" }
    );
  } catch (err) {
    console.warn("profiles fallback upsert failed:", err);
  }

  return merged;
}
