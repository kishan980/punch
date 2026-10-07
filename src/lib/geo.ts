/**
 * Client-safe Geolocation & Haversine Distance Utilities
 * Free of server-only secrets or database clients.
 */

export interface GymLocationConfig {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isEnabled: boolean;
  officeName: string;
}

export const DEFAULT_LOCATION_CONFIG: GymLocationConfig = {
  latitude: 19.0760, // Example default latitude
  longitude: 72.8777, // Example default longitude
  radiusMeters: 10, // 10 meters strict geofence radius
  isEnabled: true, // Enabled by default
  officeName: "Main Gym / Office",
};

/**
 * Calculates distance between two GPS coordinates in meters using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
