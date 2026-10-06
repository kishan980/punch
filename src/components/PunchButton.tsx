"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint, CheckCircle2, AlertCircle, Loader2, LogIn, LogOut, Radio } from "lucide-react";
import type { PunchType } from "@/types/attendance";
import { soundEffects, triggerHaptic } from "@/lib/audio";

interface PunchButtonProps {
  currentPunchType: PunchType; // Next expected punch: 'in' or 'out'
  onSuccess?: () => void;
  disabled?: boolean;
}

export default function PunchButton({
  currentPunchType,
  onSuccess,
  disabled = false,
}: PunchButtonProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePunch = async () => {
    if (loading || disabled) return;

    triggerHaptic("click");
    soundEffects.playScanStart();

    setLoading(true);
    setStatusMessage("Initializing mobile biometric sensor...");
    setErrorMessage(null);
    setSuccessMessage(null);

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

      // Step 2 & 3: Browser opens device native authentication (Fingerprint / Face ID / PIN)
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

      // Step 5: After successful verification, call /api/attendance/punch
      setStatusMessage("Recording punch attendance...");
      const punchRes = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          punchType: currentPunchType,
        }),
      });

      const punchData = await punchRes.json();
      if (!punchRes.ok) {
        throw new Error(punchData.error || punchData.message || "Unable to record attendance. Please try again.");
      }

      // Success Sound & Mobile Vibration!
      soundEffects.playPunchSuccess();
      triggerHaptic("success");

      // Step 7: Show PUNCH SUCCESSFUL
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

  return (
    <div className="w-full flex flex-col items-center">
      {/* Big Realistic Kiosk Mobile Action Button */}
      <div className="w-full relative group">
        <button
          onClick={handlePunch}
          disabled={loading || disabled}
          aria-label={isPunchIn ? "Punch In" : "Punch Out"}
          className={`w-full py-6 px-6 rounded-3xl font-black text-lg flex flex-col items-center justify-center gap-3 transition-all duration-300 shadow-2xl relative overflow-hidden select-none border ${
            disabled
              ? "bg-slate-900 text-slate-600 cursor-not-allowed border-slate-800"
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
                : "bg-black/30 ring-1 ring-white/10"
            }`}
          >
            {loading ? (
              <Loader2 className="w-10 h-10 animate-spin text-emerald-300" />
            ) : (
              <Fingerprint className="w-11 h-11 text-white animate-pulse" />
            )}
          </div>

          <div className="text-center space-y-0.5">
            <span className="tracking-widest uppercase text-xs font-semibold text-white/80 flex items-center justify-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-300" />
              <span>TOUCH SENSOR TO</span>
            </span>
            <div className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              {isPunchIn ? (
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
        <div className="mt-4 p-3.5 rounded-2xl bg-white border border-emerald-300 text-emerald-800 text-xs flex items-center gap-3 shadow-md">
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-600" />
          <span className="font-semibold">{statusMessage}</span>
        </div>
      )}

      {/* Success notification */}
      {successMessage && (
        <div className="mt-4 w-full p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-3 shadow-md">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <span className="font-bold text-sm">{successMessage}</span>
        </div>
      )}

      {/* Error notification */}
      {errorMessage && (
        <div className="mt-4 w-full p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-3 shadow-md">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-rose-900">{errorMessage}</div>
            {errorMessage.includes("register this phone") && (
              <a
                href="/member/register-biometric"
                className="mt-1.5 text-xs text-emerald-600 underline block hover:text-emerald-800 font-bold"
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
