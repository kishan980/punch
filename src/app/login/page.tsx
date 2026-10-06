"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Dumbbell,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  Fingerprint,
  UserPlus,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "signup") {
        // Instant Auto-Confirm Sign Up (No email confirmation required!)
        const signupRes = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            fullName,
          }),
        });

        const signupData = await signupRes.json();
        if (!signupRes.ok) {
          throw new Error(signupData.error || "Failed to create account.");
        }

        setSuccess("Account created successfully! Logging you in...");

        // Automatically sign in with the same email and password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        setTimeout(() => {
          router.push("/member");
          router.refresh();
        }, 500);
      } else {
        // Login Flow
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (!data.user) {
          throw new Error("No user returned after authentication.");
        }

        // Fetch user profile to redirect properly
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("auth_user_id", data.user.id)
          .single();

        if (profile?.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/member");
        }
        router.refresh();
      }
    } catch (err: unknown) {
      const authErr = err as Error;
      if (authErr.message?.includes("Invalid login credentials")) {
        setError(
          "User does not exist in Supabase yet. Click the 'Auto-Create Demo Accounts' button below to create it in 1 second!"
        );
      } else {
        setError(authErr.message || "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Instant Demo Accounts Creator
  const handleAutoCreateDemoAccounts = async (targetRole: "member" | "admin" = "member") => {
    setSetupLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/auth/demo-setup", {
        method: "POST",
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to initialize demo accounts.");
      }

      const targetEmail = targetRole === "admin" ? "admin@gympunch.local" : "member@gympunch.local";
      const targetPass = targetRole === "admin" ? "admin123456" : "member123456";

      setEmail(targetEmail);
      setPassword(targetPass);
      setSuccess("Demo accounts created in Supabase! Logging in now...");

      // Automatically log in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPass,
      });

      if (signInError) throw signInError;

      setTimeout(() => {
        if (targetRole === "admin") {
          router.push("/admin");
        } else {
          router.push("/member");
        }
        router.refresh();
      }, 500);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to auto-create demo users.");
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <main className="mobile-container justify-center py-10">
      <div className="w-full max-w-sm mx-auto space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-400 items-center justify-center text-white shadow-xl shadow-emerald-950/60 mb-2">
            <Dumbbell className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            Gym Punch Demo
          </h1>
          <p className="text-xs text-slate-400">
            Mobile Biometric Attendance with WebAuthn &amp; Supabase
          </p>
        </div>

        {/* Login / Sign Up Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setSuccess(null);
              }}
              className={`py-2 rounded-lg font-bold transition-colors ${
                mode === "login"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setSuccess(null);
              }}
              className={`py-2 rounded-lg font-bold transition-colors ${
                mode === "signup"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <UserPlus className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Kishan Yadav"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@gympunch.local"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || setupLoading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-950/50 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{mode === "signup" ? "CREATING ACCOUNT..." : "AUTHENTICATING..."}</span>
                </>
              ) : (
                <span>{mode === "signup" ? "CREATE ACCOUNT" : "LOGIN"}</span>
              )}
            </button>
          </form>

          {/* 1-Click Instant Setup Section */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Instant Demo One-Click Setup
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatically creates test users in your Supabase database:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                disabled={setupLoading || loading}
                onClick={() => handleAutoCreateDemoAccounts("member")}
                className="py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-left transition-all flex items-center gap-2 disabled:opacity-60 active:scale-[0.98]"
              >
                {setupLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Fingerprint className="w-3.5 h-3.5" />
                )}
                <span>1-Click Member</span>
              </button>

              <button
                type="button"
                disabled={setupLoading || loading}
                onClick={() => handleAutoCreateDemoAccounts("admin")}
                className="py-2.5 px-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 font-semibold text-left transition-all flex items-center gap-2 disabled:opacity-60 active:scale-[0.98]"
              >
                {setupLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>1-Click Admin</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
