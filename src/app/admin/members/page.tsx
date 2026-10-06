import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, LogIn, LogOut, Clock } from "lucide-react";

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

  // 3. Fetch today's punches to see today's user-wise IN & OUT times
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: todayPunches } = await supabase
    .from("attendance")
    .select("user_id, punch_type, punch_time")
    .gte("punch_time", startOfDay)
    .order("punch_time", { ascending: true });

  // Compute User-Wise Punch IN and OUT details
  const userPunchMap: Record<
    string,
    {
      firstInTime: string | null;
      lastOutTime: string | null;
      latestType: string | null;
    }
  > = {};

  todayPunches?.forEach((p) => {
    if (!userPunchMap[p.user_id]) {
      userPunchMap[p.user_id] = {
        firstInTime: null,
        lastOutTime: null,
        latestType: null,
      };
    }

    if (p.punch_type === "in" && !userPunchMap[p.user_id].firstInTime) {
      userPunchMap[p.user_id].firstInTime = p.punch_time;
    }
    if (p.punch_type === "out") {
      userPunchMap[p.user_id].lastOutTime = p.punch_time;
    }
    userPunchMap[p.user_id].latestType = p.punch_type;
  });

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar
        userRole="admin"
        memberName={adminProfile.full_name}
        memberCode={adminProfile.member_code}
      />

      <main className="max-w-4xl mx-auto w-full px-4 py-6 flex-1 space-y-6">
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
            Member Management &amp; Today&apos;s Punches
          </h1>
          <p className="text-xs text-slate-400">
            User-wise biometric passkey status and live IN / OUT timestamps.
          </p>
        </div>

        {/* Member List Table with User-Wise In & Out */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3 font-bold whitespace-nowrap">Member ID</th>
                  <th className="py-3 px-3 font-bold whitespace-nowrap">Name</th>
                  <th className="py-3 px-3 font-bold whitespace-nowrap">Phone</th>
                  <th className="py-3 px-3 font-bold whitespace-nowrap">Status</th>
                  <th className="py-3 px-3 font-bold whitespace-nowrap">Biometric</th>
                  <th className="py-3 px-3 font-bold whitespace-nowrap">Today&apos;s Punch IN / OUT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {members?.map((member) => {
                  const isRegistered = registeredUserIds.has(member.auth_user_id);
                  const punchData = userPunchMap[member.auth_user_id];
                  const isInside = punchData?.latestType === "in";

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {member.member_code}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-200 whitespace-nowrap">
                        {member.full_name}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {member.phone || "—"}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                            member.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isRegistered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Registered ✅</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Not Registered</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {punchData?.firstInTime ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 font-mono whitespace-nowrap">
                              <LogIn className="w-2.5 h-2.5 shrink-0" />
                              <span>IN: {formatTime(punchData.firstInTime)}</span>
                            </span>

                            {punchData.lastOutTime ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 font-mono whitespace-nowrap">
                                <LogOut className="w-2.5 h-2.5 shrink-0" />
                                <span>OUT: {formatTime(punchData.lastOutTime)}</span>
                              </span>
                            ) : isInside ? (
                              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
                                INSIDE GYM
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] whitespace-nowrap">No punches today</span>
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
