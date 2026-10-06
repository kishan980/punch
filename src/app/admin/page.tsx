import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import AdminDashboardClient from "./AdminDashboardClient";
import type { AttendanceRecord } from "@/types/attendance";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify Admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/member");
  }

  // 1. Total Members Count
  const { count: totalMembers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "member");

  // 2. Today's Punches
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: todayPunchesRaw } = await supabase
    .from("attendance")
    .select("*, profiles (full_name, member_code, phone)")
    .gte("punch_time", startOfDay)
    .order("punch_time", { ascending: false });

  const todayPunches = (todayPunchesRaw as unknown as AttendanceRecord[]) || [];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar
        userRole="admin"
        memberName={profile.full_name}
        memberCode={profile.member_code}
      />

      <main className="max-w-2xl mx-auto w-full px-4 py-6 flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Admin Portal
            </span>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight mt-1">
              GYM ADMIN
            </h1>
            <p className="text-xs text-slate-400">
              Live attendance monitoring &amp; biometric management
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin/members"
              className="px-3 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors border border-slate-700"
            >
              Members
            </Link>
            <Link
              href="/admin/attendance"
              className="px-3 py-2 rounded-xl bg-emerald-600/90 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              All Logs
            </Link>
          </div>
        </div>

        {/* Live Realtime Client Component */}
        <AdminDashboardClient
          initialTotalMembers={totalMembers || 0}
          initialTodayPunches={todayPunches}
        />
      </main>
    </div>
  );
}
