"use client";

import { useState, useEffect } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import {
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  ShieldCheck,
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
      setStatusMessage("Touch fingerprint or verify Face ID on this phone...");
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
          throw new Error("OnePlus / Android Security Notice: Please make sure 'Screen lock' (PIN/Password) and Fingerprint are active in OnePlus Settings. If using private/incognito mode, open in normal Chrome tab.");
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

      setSuccessMessage("Biometric registered successfully ✅ This phone is now linked!");
      setStatusMessage(null);
      setCredentialCount((prev) => prev + 1);

      if (onRegistered) {
        onRegistered();
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "Failed to register biometric.");
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  // Test Registered Biometric (WebAuthn get assertion)
  const handleTestBiometric = async () => {
    setTesting(true);
    setStatusMessage("Testing biometric authentication...");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const optionsRes = await fetch("/api/webauthn/authentication/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) {
        throw new Error(optionsData.error || "Unable to test biometric.");
      }

      setStatusMessage("Touch fingerprint sensor on phone...");
      const authResponse = await startAuthentication({
        optionsJSON: optionsData,
      });

      setStatusMessage("Verifying signature...");
      const verifyRes = await fetch("/api/webauthn/authentication/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResponse),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Biometric test failed.");
      }

      setSuccessMessage("Biometric test passed! Phone sensor is verified ✅");
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
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Smartphone className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">Mobile Phone Biometric Setup</h2>
          <p className="text-xs text-slate-400">
            {credentialCount > 0
              ? `${credentialCount} device(s) linked with Passkey`
              : "No biometric devices linked yet"}
          </p>
        </div>
      </div>

      {/* Live Phone Sensor Diagnostics Card */}
      {deviceCheck.checked && (
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="font-semibold text-slate-300 flex items-center justify-between">
            <span>Hardware Diagnostics:</span>
            {!deviceCheck.isSecure ? (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Insecure HTTP (No HTTPS)</span>
              </span>
            ) : deviceCheck.hasBiometric ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sensor Ready</span>
              </span>
            ) : (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Screen PIN/Bio Available</span>
              </span>
            )}
          </div>

          {!deviceCheck.isSecure && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/30 text-[11px] text-rose-300">
              ⚠️ Mobile browsers (Chrome / Safari) disable biometric sensors on plain HTTP.
              Please open this app over <strong>HTTPS</strong> (e.g. using localtunnel or ngrok tunnel).
            </div>
          )}
        </div>
      )}

      {/* Main Register / Link Buttons */}
      <div className="space-y-3">
        {credentialCount > 0 && (
          <a
            href="/member"
            className="w-full py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-950/60 active:scale-[0.98] transition-all border border-emerald-400/30 text-center"
          >
            <Fingerprint className="w-6 h-6 animate-pulse" />
            <span>🔐 GO TO PUNCH IN / OUT</span>
          </a>
        )}

        <button
          onClick={handleRegister}
          disabled={loading || testing}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed border ${
            credentialCount > 0
              ? "bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700"
              : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-950/60 border-emerald-400/30"
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
                  ? "RE-LINK / ADD NEW FINGERPRINT"
                  : "LINK THIS PHONE BIOMETRIC"}
              </span>
            </>
          )}
        </button>

        {credentialCount > 0 && (
          <button
            onClick={handleTestBiometric}
            disabled={loading || testing}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 bg-slate-800/60 hover:bg-slate-700 text-emerald-300 border border-slate-700/80 active:scale-[0.98] transition-all disabled:opacity-60"
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
      <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/20 text-[11px] text-slate-300 space-y-1.5">
        <div className="font-bold text-emerald-400 flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" />
          <span>iPhone Face ID &amp; Android Biometric Support:</span>
        </div>
        <p className="text-slate-400 leading-relaxed">
          • <strong>iPhone:</strong> Button dabate hi Apple ka <strong>Face ID</strong> scanner open hoga aur chehra scan karke attendance punch karega.<br />
          • <strong>Android:</strong> Phone ke Settings me jo bhi active hai (<strong>Face Unlock</strong> ya <strong>Fingerprint</strong>), wahi screen par popup aayega aur instantly verify karega!
        </p>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mt-3 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
