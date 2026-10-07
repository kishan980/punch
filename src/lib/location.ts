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
 * Checks Supabase table first; falls back to runtime cache or default.
 */
export async function getLocationConfig(): Promise<GymLocationConfig> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("gym_location_settings")
      .select("*")
      .eq("id", "default")
      .single();

    if (!error && data) {
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
    console.warn("Could not query gym_location_settings from Supabase:", err);
  }

  // Fallback to in-memory cache or default
  return globalThis.__gym_location_cache || DEFAULT_LOCATION_CONFIG;
}

/**
 * Saves/updates office location settings.
 * Persists to Supabase and updates in-memory cache.
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

  try {
    const admin = createAdminClient();
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
    console.warn("Failed to persist gym_location_settings to Supabase, cached in memory:", err);
  }

  return merged;
}
