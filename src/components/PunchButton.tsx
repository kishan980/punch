"use client";

import { useState, useEffect, useCallback } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn,
  LogOut,
  Radio,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Navigation,
} from "lucide-react";
import type { PunchType } from "@/types/attendance";
import { soundEffects, triggerHaptic } from "@/lib/audio";
import { calculateDistanceMeters, type GymLocationConfig } from "@/lib/geo";

interface PunchButtonProps {
  currentPunchType: PunchType; // Next expected punch: 'in' or 'out'
  onSuccess?: () => void;
  disabled?: boolean;
}

type LocationStatus = "loading" | "inside" | "outside" | "error" | "disabled";

export default function PunchButton({
  currentPunchType,
  onSuccess,
  disabled = false,
}: PunchButtonProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // GPS Geofence States
  const [locationConfig, setLocationConfig] = useState<GymLocationConfig | null>(null);
  const [memberCoords, setMemberCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("loading");
  const [locatingInProgress, setLocatingInProgress] = useState(false);
  const [settingOfficeLoading, setSettingOfficeLoading] = useState(false);

  // Function to verify GPS location against office coordinates
  const verifyLocation = useCallback(async (activeConfig?: GymLocationConfig) => {
    setLocatingInProgress(true);

    try {
      // 1. Fetch config if not provided
      let cfg = activeConfig || locationConfig;
      if (!cfg) {
        const res = await fetch("/api/admin/location");
        if (res.ok) {
          cfg = await res.json();
          setLocationConfig(cfg);
        }
      }

      if (!cfg || !cfg.isEnabled) {
        setLocationStatus("disabled");
        setLocatingInProgress(false);
        return { isInside: true, coords: null };
      }

      // 2. Request browser geolocation
      if (!("geolocation" in navigator)) {
        setLocationStatus("error");
        setLocatingInProgress(false);
        return { isInside: false, coords: null, error: "Geolocation is not supported by your browser." };
      }

      return new Promise<{
        isInside: boolean;
        coords: { latitude: number; longitude: number } | null;
        distance?: number;
        error?: string;
      }>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            setMemberCoords({ latitude: lat, longitude: lon });

            const dist = calculateDistanceMeters(lat, lon, cfg!.latitude, cfg!.longitude);
            setDistanceMeters(dist);

            const inside = dist <= cfg!.radiusMeters;
            setLocationStatus(inside ? "inside" : "outside");
            setLocatingInProgress(false);

            resolve({
              isInside: inside,
              coords: { latitude: lat, longitude: lon },
              distance: dist,
            });
          },
          (err) => {
            console.warn("Geolocation acquisition error:", err);
            setLocationStatus("error");
            setLocatingInProgress(false);
            let errMsg = "Unable to retrieve device location.";
            if (err.code === 1) {
              errMsg = "GPS permission denied. Please allow location access in your browser settings.";
            } else if (err.code === 2) {
              errMsg = "Position unavailable. Please ensure GPS is turned ON.";
            } else if (err.code === 3) {
              errMsg = "Location request timed out. Please retry.";
            }
            resolve({ isInside: false, coords: null, error: errMsg });
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0,
          }
        );
      });
    } catch {
      setLocationStatus("disabled");
      setLocatingInProgress(false);
      return { isInside: true, coords: null };
    }
  }, [locationConfig]);

  // Initial check on component mount
  useEffect(() => {
    verifyLocation();
  }, [verifyLocation]);

  // Set User's CURRENT LOCATION as the Office Location instantly!
  const handleSetCurrentLocationAsOffice = async () => {
    if (!("geolocation" in navigator)) {
      setErrorMessage("Aapka device GPS support nahi karta.");
      return;
    }

    setSettingOfficeLoading(true);
    setErrorMessage(null);
    setStatusMessage("Aapki current location detect karke office set ki jaa rahi hai...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const currentLat = Number(pos.coords.latitude.toFixed(6));
        const currentLon = Number(pos.coords.longitude.toFixed(6));

        try {
          const res = await fetch("/api/admin/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: currentLat,
              longitude: currentLon,
              radiusMeters: 10,
              isEnabled: true,
              officeName: "Current Office",
              calibrate: true,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to update office location.");
          }

          setLocationConfig(data.config);
          setMemberCoords({ latitude: currentLat, longitude: currentLon });
          setDistanceMeters(0);
          setLocationStatus("inside");

          soundEffects.playPunchSuccess();
          triggerHaptic("success");
          setSuccessMessage("✅ Office location updated to your current location! Punch is now unlocked.");
          setStatusMessage(null);

          setTimeout(() => {
            setSuccessMessage(null);
          }, 4000);
        } catch (e) {
          const err = e as Error;
          setErrorMessage(err.message || "Failed to set office location.");
          setStatusMessage(null);
        } finally {
          setSettingOfficeLoading(false);
        }
      },
      (err) => {
        setSettingOfficeLoading(false);
        setStatusMessage(null);
        setErrorMessage(
          err.code === 1
            ? "Location permission denied. Please allow GPS access on your phone."
            : "Could not get current GPS coordinates."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handlePunch = async () => {
    if (loading || disabled) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Check Geofence before starting biometric scan
    let currentCoords = memberCoords;
    if (locationConfig?.isEnabled) {
      if (locationStatus === "outside" && distanceMeters !== null) {
        soundEffects.playPunchError();
        triggerHaptic("error");
        setErrorMessage(
          `Aap office area se bahar hain (${distanceMeters}m door, Allowed: ${locationConfig.radiusMeters}m). Punch sirf office ke andar allow hai.`
        );
        return;
      }

      // If location is not yet ready, verify it now
      if (!currentCoords || locationStatus !== "inside") {
        setStatusMessage("Verifying office GPS location...");
        const locResult = await verifyLocation();
        if (!locResult.isInside) {
          soundEffects.playPunchError();
          triggerHaptic("error");
          if (locResult.error) {
            setErrorMessage(locResult.error);
          } else if (locResult.distance !== undefined) {
            setErrorMessage(
              `Aap office area se bahar hain (${locResult.distance}m door, Allowed: ${locationConfig.radiusMeters}m). Punch sirf office ke andar allow hai.`
            );
          } else {
            setErrorMessage("Office location verification failed. GPS turned ON hona chahiye.");
          }
          setStatusMessage(null);
          return;
        }
        currentCoords = locResult.coords;
      }
    }

    triggerHaptic("click");
    soundEffects.playScanStart();

    setLoading(true);
    setStatusMessage("Initializing mobile biometric sensor...");

    try {
      // Step 1: Call /api/webauthn/authentication/options
      const optionsRes = await fetch("/api/webauthn/authentication/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const optionsData = await optionsRes.json();

      if (!optionsRes.ok) {
        if (optionsRes.status === 404 || optionsData.error?.includes("register this phone")) {
          throw new Error("Please register this phone first.");
        }
        throw new Error(optionsData.error || "Unable to initialize biometric authentication.");
      }

      // Step 2 & 3: Device native authentication (Fingerprint / Face ID / PIN)
      setStatusMessage("Touch fingerprint or verify Face ID on phone...");
      let authResponse;
      try {
        authResponse = await startAuthentication({
          optionsJSON: optionsData,
        });
      } catch (authError: unknown) {
        const err = authError as Error;
        if (err.name === "NotAllowedError" || err.message?.includes("canceled") || err.message?.includes("cancelled")) {
          throw new Error("Biometric authentication cancelled.");
        }
        if (err.name === "NotSupportedError") {
          throw new Error("This device does not support biometric authentication.");
        }
        throw new Error("Biometric verification failed.");
      }

      // Step 4: Send authentication response to /api/webauthn/authentication/verify
      setStatusMessage("Verifying biometric signature on server...");
      const verifyRes = await fetch("/api/webauthn/authentication/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResponse),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Biometric verification failed.");
      }

      // Step 5: After successful verification, call /api/attendance/punch with GPS coordinates
      setStatusMessage("Recording punch attendance & validating location...");
      const punchRes = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          punchType: currentPunchType,
          latitude: currentCoords?.latitude,
          longitude: currentCoords?.longitude,
        }),
      });

      const punchData = await punchRes.json();
      if (!punchRes.ok) {
        throw new Error(punchData.error || punchData.message || "Unable to record attendance. Please try again.");
      }

      // Success Sound & Mobile Vibration
      soundEffects.playPunchSuccess();
      triggerHaptic("success");

      setSuccessMessage(
        currentPunchType === "in"
          ? "PUNCH IN SUCCESSFUL ✅ — Access Granted"
          : "PUNCH OUT SUCCESSFUL ✅ — Goodbye!"
      );
      setStatusMessage(null);

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } else {
        setTimeout(() => {
          window.location.href = "/member/attendance";
        }, 1000);
      }
    } catch (err: unknown) {
      soundEffects.playPunchError();
      triggerHaptic("error");

      const error = err as Error;
      setErrorMessage(error.message || "Unable to record attendance. Please try again.");
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const isPunchIn = currentPunchType === "in";
  const isBlockedByLocation = locationConfig?.isEnabled && locationStatus === "outside";

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      {/* Real-time Office Geofence Status Indicator */}
      {locationConfig?.isEnabled && (
        <div className="w-full space-y-2">
          {locationStatus === "inside" && (
            <div className="p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Office Area: <strong>Inside Zone</strong> ({distanceMeters !== null ? `~${distanceMeters}m away` : "Verified"}) ✅
                </span>
              </div>
              <button
                type="button"
                onClick={() => verifyLocation()}
                disabled={locatingInProgress}
                className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-800 transition-colors"
                title="Refresh GPS"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${locatingInProgress ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}

          {locationStatus === "outside" && (
            <div className="p-4 rounded-3xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-xs font-bold space-y-3 shadow-md">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-rose-900 font-black text-sm">OUTSIDE OFFICE AREA ❌</div>
                    <div className="text-rose-800 font-medium mt-1">
                      Aap office se <strong>{distanceMeters}m</strong> door dikh rahe hain (Allowed: <strong>{locationConfig.radiusMeters}m</strong>).
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => verifyLocation()}
                  disabled={locatingInProgress}
                  className="p-1.5 bg-rose-200 hover:bg-rose-300 text-rose-950 rounded-xl text-xs font-black transition-colors shrink-0 flex items-center gap-1"
                  title="Retry GPS"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${locatingInProgress ? "animate-spin" : ""}`} />
                  <span>Retry</span>
                </button>
              </div>

              {/* Instant Calibration Button for Office Owner */}
              <div className="pt-2 border-t border-rose-200/80 flex flex-col gap-1.5">
                <span className="text-[11px] text-slate-800 font-semibold">
                  Kya aap abhi apne office me baithe hain?
                </span>
                <button
                  type="button"
                  onClick={handleSetCurrentLocationAsOffice}
                  disabled={settingOfficeLoading}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  {settingOfficeLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Navigation className="w-4 h-4 text-emerald-200" />
                  )}
                  <span>
                    {settingOfficeLoading
                      ? "Setting Location..."
                      : "📍 Set Current Location as Office (इसे ऑफिस बनाएं)"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {locationStatus === "loading" && (
            <div className="p-3 rounded-2xl bg-slate-50 border-2 border-slate-200 text-slate-800 text-xs font-bold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
                <span>Checking Office GPS location...</span>
              </div>
            </div>
          )}

          {locationStatus === "error" && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs font-bold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Phone GPS / Location Permission ON hona zaroori hai.</span>
              </div>
              <button
                type="button"
                onClick={() => verifyLocation()}
                disabled={locatingInProgress}
                className="px-2.5 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-xl text-xs font-black transition-colors shrink-0 flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${locatingInProgress ? "animate-spin" : ""}`} />
                <span>Enable</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Big Realistic Kiosk Mobile Action Button */}
      <div className="w-full relative group">
        <button
          onClick={handlePunch}
          disabled={loading || disabled || isBlockedByLocation}
          aria-label={isPunchIn ? "Punch In" : "Punch Out"}
          className={`w-full py-6 px-6 rounded-3xl font-black text-lg flex flex-col items-center justify-center gap-3 transition-all duration-300 shadow-2xl relative overflow-hidden select-none border ${
            disabled || isBlockedByLocation
              ? "bg-slate-800 text-slate-400 cursor-not-allowed border-slate-700 opacity-80"
              : isPunchIn
              ? "bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white shadow-emerald-950/80 active:scale-[0.98] border-emerald-400/40"
              : "bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white shadow-amber-950/80 active:scale-[0.98] border-amber-400/40"
          }`}
        >
          {/* Laser Scanner Line Effect while authenticating */}
          {loading && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_15px_#10b981] animate-bounce" />
            </div>
          )}

          {/* Biometric Scanner Visual Graphic */}
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              loading
                ? "bg-emerald-400/20 ring-4 ring-emerald-400/50 scale-105"
                : isBlockedByLocation
                ? "bg-slate-700/60 ring-1 ring-white/10"
                : "bg-black/30 ring-1 ring-white/10"
            }`}
          >
            {loading ? (
              <Loader2 className="w-10 h-10 animate-spin text-emerald-300" />
            ) : isBlockedByLocation ? (
              <ShieldAlert className="w-11 h-11 text-rose-400" />
            ) : (
              <Fingerprint className="w-11 h-11 text-white animate-pulse" />
            )}
          </div>

          <div className="text-center space-y-0.5">
            <span className="tracking-widest uppercase text-xs font-semibold text-white/80 flex items-center justify-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-300" />
              <span>{isBlockedByLocation ? "LOCATION LOCKED" : "TOUCH SENSOR TO"}</span>
            </span>
            <div className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              {isBlockedByLocation ? (
                <span>OUTSIDE OFFICE</span>
              ) : isPunchIn ? (
                <>
                  <LogIn className="w-6 h-6 text-emerald-300" />
                  <span>PUNCH IN</span>
                </>
              ) : (
                <>
                  <LogOut className="w-6 h-6 text-amber-300" />
                  <span>PUNCH OUT</span>
                </>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Loading state indicator */}
      {statusMessage && (
        <div className="w-full p-3.5 rounded-2xl bg-white border-2 border-emerald-300 text-emerald-800 text-xs flex items-center gap-3 shadow-md font-bold">
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Success notification */}
      {successMessage && (
        <div className="w-full p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900 text-xs flex items-center gap-3 shadow-md">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <span className="font-bold text-sm">{successMessage}</span>
        </div>
      )}

      {/* Error notification */}
      {errorMessage && (
        <div className="w-full p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs flex items-start gap-3 shadow-md">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-rose-950 text-sm leading-tight">{errorMessage}</div>
            {errorMessage.includes("register this phone") && (
              <a
                href="/member/register-biometric"
                className="mt-1.5 text-xs text-emerald-700 underline block hover:text-emerald-900 font-bold"
              >
                Go to Biometric Registration &rarr;
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
