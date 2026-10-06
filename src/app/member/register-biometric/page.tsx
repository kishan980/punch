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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        userRole={profile?.role || "member"}
        memberName={profile?.full_name}
        memberCode={profile?.member_code}
      />

      <main className="mobile-container py-6 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/member"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-[10px] font-mono text-emerald-700 font-bold uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Passkey Security
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            Register Biometric Device
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Link this phone&apos;s native Face ID or Fingerprint for instant attendance punching.
          </p>
        </div>

        {/* Biometric Register Component */}
        <BiometricRegister initialCredentialCount={credentials?.length || 0} />

        {/* List of Registered Credentials */}
        {credentials && credentials.length > 0 && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Registered Authenticators ({credentials.length})</span>
            </h3>

            <div className="space-y-2">
              {credentials.map((cred, idx) => (
                <div
                  key={cred.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">
                        Device #{idx + 1} (Passkey)
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        ID: {cred.credential_id.slice(0, 16)}...
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>Active</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
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
