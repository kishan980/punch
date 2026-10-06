import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import BiometricRegister from "@/components/BiometricRegister";
import Link from "next/link";
import { ArrowLeft, Smartphone, ShieldCheck, CheckCircle } from "lucide-react";

export default async function RegisterBiometricPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  // Fetch user credentials
  const { data: credentials } = await supabase
    .from("webauthn_credentials")
    .select("id, credential_id, created_at, counter")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar
        userRole={profile?.role || "member"}
        memberName={profile?.full_name}
        memberCode={profile?.member_code}
      />

      <main className="mobile-container py-6 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/member"
            className="inline-flex items-center gap-1.5 text-sm text-slate-800 hover:text-black font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-xs font-mono text-emerald-800 font-black uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
            Passkey Security
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-black text-black uppercase tracking-tight">
            Register Biometric Device
          </h1>
          <p className="text-sm text-slate-700 font-semibold">
            Link this phone&apos;s native Face ID or Fingerprint for instant attendance punching.
          </p>
        </div>

        {/* Biometric Register Component */}
        <BiometricRegister initialCredentialCount={credentials?.length || 0} />

        {/* List of Registered Credentials */}
        {credentials && credentials.length > 0 && (
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 space-y-3 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Registered Authenticators ({credentials.length})</span>
            </h3>

            <div className="space-y-2">
              {credentials.map((cred, idx) => (
                <div
                  key={cred.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-black text-black text-sm">
                        Device #{idx + 1} (Passkey)
                      </div>
                      <div className="text-xs font-mono text-slate-600 font-bold">
                        ID: {cred.credential_id.slice(0, 16)}...
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 text-xs text-emerald-800 font-black bg-emerald-100 px-2 py-0.5 rounded-md">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Active</span>
                    </div>
                    <div className="text-xs font-mono text-slate-600 font-bold mt-1">
                      {new Date(cred.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
