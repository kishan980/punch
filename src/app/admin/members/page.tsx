import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Search } from "lucide-react";

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    redirect("/member");
  }

  // 1. Fetch all member profiles
  const { data: members } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  // 2. Fetch all credentials to see which members have registered biometrics
  const { data: credentials } = await supabase
    .from("webauthn_credentials")
    .select("user_id");

  const registeredUserIds = new Set(credentials?.map((c) => c.user_id) || []);

  // 3. Fetch today's punches to see today's status
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: todayPunches } = await supabase
    .from("attendance")
    .select("user_id, punch_type, punch_time")
    .gte("punch_time", startOfDay)
    .order("punch_time", { ascending: true });

  const userTodayPunchMap: Record<string, string> = {};
  todayPunches?.forEach((p) => {
    userTodayPunchMap[p.user_id] = p.punch_type;
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar
        userRole="admin"
        memberName={adminProfile.full_name}
        memberCode={adminProfile.member_code}
      />

      <main className="max-w-3xl mx-auto w-full px-4 py-6 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-xs text-slate-400 font-mono">
            {members?.length || 0} Total Members
          </span>
        </div>

        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">
            Member Management
          </h1>
          <p className="text-xs text-slate-400">
            View member profiles, biometric passkey status, and live attendance state.
          </p>
        </div>

        {/* Member List Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="pb-3 font-bold">Member ID</th>
                  <th className="pb-3 font-bold">Name</th>
                  <th className="pb-3 font-bold">Phone</th>
                  <th className="pb-3 font-bold">Status</th>
                  <th className="pb-3 font-bold">Biometric</th>
                  <th className="pb-3 font-bold">Today&apos;s Punch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {members?.map((member) => {
                  const isRegistered = registeredUserIds.has(member.auth_user_id);
                  const todayPunch = userTodayPunchMap[member.auth_user_id];

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 font-mono font-bold text-emerald-400">
                        {member.member_code}
                      </td>
                      <td className="py-3.5 font-semibold text-slate-200">
                        {member.full_name}
                      </td>
                      <td className="py-3.5 font-mono text-slate-400">
                        {member.phone || "—"}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            member.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="py-3.5">
                        {isRegistered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Registered ✅</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Not Registered</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5">
                        {todayPunch === "in" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Punched In
                          </span>
                        ) : todayPunch === "out" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                            Punched Out
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
