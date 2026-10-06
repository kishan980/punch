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
  Eye,
  EyeOff,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        setTimeout(() => {
          if (email.toLowerCase().includes("admin")) {
            window.location.href = "/admin";
          } else {
            window.location.href = "/member";
          }
        }, 500);
      } else {
        // Sign In
        let signInRes = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        // If credentials failed and this is a demo account or admin email, auto-seed and retry once
        if (
          signInRes.error &&
          (email.toLowerCase().includes("admin") || email.toLowerCase().includes("gympunch.local"))
        ) {
          try {
            await fetch("/api/auth/seed-demo-users", { method: "POST" });
            signInRes = await supabase.auth.signInWithPassword({
              email,
              password,
            });
          } catch {
            // ignore seed error and proceed to handle signInRes.error
          }
        }

        if (signInRes.error) throw signInRes.error;

        const authUser = signInRes.data.user;
        if (!authUser) {
          throw new Error("No user returned after authentication.");
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("auth_user_id", authUser.id)
          .single();

        const isAdmin = email.toLowerCase().includes("admin") || profile?.role === "admin";
        if (isAdmin) {
          window.location.href = "/admin";
        } else {
          window.location.href = "/member";
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSeed = async () => {
    setSetupLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/auth/seed-demo-users", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seeding failed.");
      setSuccess("Demo accounts ready! Click Admin or Member to quick-login.");
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Failed to initialize demo accounts.");
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-10 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 mb-2">
            <Dumbbell className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black uppercase">
            Gym Punch Demo
          </h1>
          <p className="text-sm text-slate-700 font-bold">
            Mobile Biometric Attendance with WebAuthn &amp; Supabase
          </p>
        </div>

        {/* Login / Sign Up Card */}
        <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-200 rounded-2xl text-xs font-black">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setSuccess(null);
              }}
              className={`py-2.5 rounded-xl transition-all ${
                mode === "login"
                  ? "bg-white text-black shadow-xs font-black"
                  : "text-slate-700 hover:text-black font-bold"
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
              className={`py-2.5 rounded-xl transition-all ${
                mode === "signup"
                  ? "bg-white text-black shadow-xs font-black"
                  : "text-slate-700 hover:text-black font-bold"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserPlus className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Kishan Yadav"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border-2 border-slate-300 text-sm text-black placeholder-slate-500 font-bold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@gympunch.local"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border-2 border-slate-300 text-sm text-black placeholder-slate-500 font-bold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 rounded-2xl bg-white border-2 border-slate-300 text-sm text-black placeholder-slate-500 font-bold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-600 hover:text-black focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs flex items-start gap-2.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs flex items-center gap-2.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : mode === "signup" ? (
                <span>Create Account &amp; Login</span>
              ) : (
                <span>Sign In to Terminal</span>
              )}
            </button>
          </form>

          {/* Quick Demo Login Pre-sets */}
          <div className="pt-4 border-t-2 border-slate-200 space-y-3">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider block text-center">
              Quick 1-Click Demo Login
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEmail("member@gympunch.local");
                  setPassword("Member@123456");
                  setMode("login");
                }}
                className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border-2 border-slate-300 text-black font-black transition-all"
              >
                Member User
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@gympunch.local");
                  setPassword("Admin@123456");
                  setMode("login");
                }}
                className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border-2 border-slate-300 text-black font-black transition-all"
              >
                Admin Manager
              </button>
            </div>

            <button
              type="button"
              onClick={handleQuickSeed}
              disabled={setupLoading}
              className="w-full py-2 px-3 text-xs font-black text-emerald-800 hover:text-emerald-950 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{setupLoading ? "Initializing..." : "Reset / Seed Demo Accounts"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
