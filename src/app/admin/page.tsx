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
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar
        userRole="admin"
        memberName={profile.full_name}
        memberCode={profile.member_code}
      />

      <main className="max-w-3xl mx-auto w-full px-4 py-6 flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
              Admin Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-black uppercase tracking-tight mt-1.5">
              GYM ADMIN
            </h1>
            <p className="text-sm text-slate-700 font-semibold">
              Live attendance monitoring &amp; biometric management
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin/members"
              className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-900 hover:bg-slate-200 transition-colors border border-slate-300 shadow-xs"
            >
              Members
            </Link>
            <Link
              href="/admin/attendance"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm"
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
