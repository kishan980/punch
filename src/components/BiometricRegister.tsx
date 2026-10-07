"use client";

import { useState, useEffect } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import {
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  RefreshCw,
  AlertTriangle,
  Lock,
} from "lucide-react";

interface BiometricRegisterProps {
  initialCredentialCount?: number;
  onRegistered?: () => void;
}

export default function BiometricRegister({
  initialCredentialCount = 0,
  onRegistered,
}: BiometricRegisterProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [credentialCount, setCredentialCount] = useState(initialCredentialCount);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Device Biometric Diagnostics State
  const [deviceCheck, setDeviceCheck] = useState<{
    isSecure: boolean;
    hasWebAuthn: boolean;
    hasBiometric: boolean;
    checked: boolean;
  }>({
    isSecure: true,
    hasWebAuthn: true,
    hasBiometric: true,
    checked: false,
  });

  useEffect(() => {
    async function checkDevice() {
      const isSecure = typeof window !== "undefined" && Boolean(window.isSecureContext);
      const hasWebAuthn = typeof window !== "undefined" && "PublicKeyCredential" in window;
      let hasBiometric = false;
      if (hasWebAuthn && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        try {
          hasBiometric = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch {}
      }
      setDeviceCheck({ isSecure, hasWebAuthn, hasBiometric, checked: true });
    }
    checkDevice();
  }, []);

  // Register Phone Biometric (WebAuthn create credential)
  const handleRegister = async () => {
    setLoading(true);
    setStatusMessage("Requesting registration challenge from server...");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Get registration options
      const optionsRes = await fetch("/api/webauthn/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        throw new Error(optionsData.error || "Failed to initiate registration.");
      }

      // 2. Prompt device biometric
      setStatusMessage("Verify Face ID or touch fingerprint on this phone...");
      let attestationResponse;
      try {
        attestationResponse = await startRegistration({
          optionsJSON: optionsData,
        });
      } catch (clientErr: unknown) {
        const err = clientErr as Error;
        console.error("Client registration error:", err);
        if (
          err.name === "NotAllowedError" ||
          err.message?.includes("canceled") ||
          err.message?.includes("cancelled")
        ) {
          throw new Error("Biometric authentication cancelled.");
        }
        if (err.name === "NotSupportedError") {
          throw new Error("Security Notice: Please ensure Screen lock / PIN is set up on your phone. If in private/incognito mode, open in normal tab.");
        }
        throw new Error(err.message || "Biometric registration was declined or failed.");
      }

      // 3. Verify attestation on server
      setStatusMessage("Saving verified biometric key to database...");
      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestationResponse),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Biometric verification failed.");
      }

      // 4. Success!
      setSuccessMessage(
        "Phone Biometric linked successfully! You can now use Face ID or Fingerprint."
      );
      setCredentialCount((prev) => prev + 1);
      setStatusMessage(null);

      if (onRegistered) {
        onRegistered();
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "Biometric registration failed. Please try again.");
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  // Quick Test Biometric Authentication
  const handleTestBiometric = async () => {
    setTesting(true);
    setStatusMessage("Initializing biometric sensor test...");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const optionsRes = await fetch("/api/webauthn/authentication/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        throw new Error(optionsData.error || "Failed to fetch authentication options.");
      }

      setStatusMessage("Verify Face ID or fingerprint now...");
      const authResponse = await startAuthentication({
        optionsJSON: optionsData,
      });

      setStatusMessage("Verifying signature with server...");
      const verifyRes = await fetch("/api/webauthn/authentication/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResponse),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Sensor verification failed.");
      }

      setSuccessMessage("Sensor test PASSED! Biometric verified in 0.4s.");
      setStatusMessage(null);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "NotAllowedError" || error.message?.includes("canceled")) {
        setErrorMessage("Biometric authentication cancelled.");
      } else {
        setErrorMessage(error.message || "Biometric verification failed.");
      }
      setStatusMessage(null);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="w-full bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
          <Smartphone className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-black text-black">Mobile Phone Biometric Setup</h2>
          <p className="text-xs text-slate-700 font-bold">
            {credentialCount > 0
              ? `${credentialCount} device(s) linked with Passkey`
              : "No biometric devices linked yet"}
          </p>
        </div>
      </div>

      {/* Live Phone Sensor Diagnostics Card */}
      {deviceCheck.checked && (
        <div className="p-3.5 rounded-2xl bg-slate-50 border-2 border-slate-200 space-y-2 text-xs">
          <div className="font-bold text-black flex items-center justify-between">
            <span>Hardware Diagnostics:</span>
            {!deviceCheck.isSecure ? (
              <span className="text-rose-700 font-black flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Insecure HTTP (No HTTPS)</span>
              </span>
            ) : deviceCheck.hasBiometric ? (
              <span className="text-emerald-800 font-black flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sensor Ready</span>
              </span>
            ) : (
              <span className="text-amber-800 font-black flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Screen PIN/Bio Available</span>
              </span>
            )}
          </div>

          {!deviceCheck.isSecure && (
            <div className="p-2.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-xs text-rose-900 font-bold">
              ⚠️ Mobile browsers (Chrome / Safari) disable biometric sensors on plain HTTP.
              Please open this app over <strong>HTTPS</strong>.
            </div>
          )}
        </div>
      )}

      {/* Main Register / Link Buttons */}
      <div className="space-y-3">
        {credentialCount > 0 && (
          <a
            href="/member"
            className="w-full py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-[0.98] transition-all text-center"
          >
            <Fingerprint className="w-6 h-6" />
            <span>GO TO PUNCH IN / OUT</span>
          </a>
        )}

        <button
          onClick={handleRegister}
          disabled={loading || testing}
          className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed border-2 ${
            credentialCount > 0
              ? "bg-slate-100 hover:bg-slate-200 text-black border-slate-300"
              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md border-emerald-600"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Registering Phone...</span>
            </>
          ) : (
            <>
              <Fingerprint className="w-5 h-5" />
              <span>
                {credentialCount > 0
                  ? "RE-LINK / ADD NEW DEVICE BIOMETRIC"
                  : "LINK THIS PHONE BIOMETRIC"}
              </span>
            </>
          )}
        </button>

        {credentialCount > 0 && (
          <button
            onClick={handleTestBiometric}
            disabled={loading || testing}
            className="w-full py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-black border-2 border-slate-300 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Testing Sensor...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>TEST SENSOR PUNCH</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Face ID & Fingerprint Biometric Tip */}
      <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-xs text-black space-y-1.5 font-medium">
        <div className="font-black text-emerald-900 flex items-center gap-1.5 text-xs">
          <Smartphone className="w-4 h-4 text-emerald-700" />
          <span>iPhone Face ID &amp; Android Biometric Support:</span>
        </div>
        <p className="text-slate-800 leading-relaxed font-semibold">
          • <strong>iPhone:</strong> Tapping the button prompts Apple&apos;s native <strong>Face ID</strong> or Touch ID for instant authentication.<br />
          • <strong>Android:</strong> Uses whichever biometric security is configured in your phone settings (<strong>Fingerprint</strong> or <strong>Face Unlock</strong>).
        </p>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border-2 border-emerald-300 text-emerald-950 text-xs flex items-center gap-2.5 font-bold">
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-700" />
          <span>{statusMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mt-3 p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs flex items-center gap-2.5 font-black">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 p-3.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs flex items-start gap-2.5 font-bold">
          <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
