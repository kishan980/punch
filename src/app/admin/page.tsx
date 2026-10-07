import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Verify Admin role: Allow if email contains admin/owner/manager or profile.role is admin
  const isAdminEmail = Boolean(
    user.email?.toLowerCase().includes("admin") ||
    user.email?.toLowerCase().includes("owner") ||
    user.email?.toLowerCase().includes("manager")
  );

  // Fetch profile via user client first
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  // If not found with user client, try adminClient safely
  if (!profile) {
    try {
      const adminClient = createAdminClient();
      const { data: p } = await adminClient
        .from("profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();
      if (p) profile = p;
    } catch {}
  }

  // If user is admin by email and profile is not yet marked admin, upsert it
  if (isAdminEmail && profile?.role !== "admin") {
    try {
      const defaultCode = profile?.member_code?.startsWith("ADM-")
        ? profile.member_code
        : "ADM-001";
      const { data: updatedProfile } = await supabase
        .from("profiles")
        .upsert(
          {
            auth_user_id: user.id,
            full_name: profile?.full_name || user.email?.split("@")[0] || "Gym Admin",
            member_code: defaultCode,
            role: "admin",
            status: "active",
          },
          { onConflict: "auth_user_id" }
        )
        .select()
        .single();
      if (updatedProfile) {
        profile = updatedProfile;
      }
    } catch {
      try {
        const adminClient = createAdminClient();
        const { data: updatedProfile } = await adminClient
          .from("profiles")
          .upsert(
            {
              auth_user_id: user.id,
              full_name: profile?.full_name || user.email?.split("@")[0] || "Gym Admin",
              member_code: "ADM-001",
              role: "admin",
              status: "active",
            },
            { onConflict: "auth_user_id" }
          )
          .select()
          .single();
        if (updatedProfile) profile = updatedProfile;
      } catch {}
    }
  }

  // Only redirect if NEITHER the email nor the profile role is admin
  const isAuthorized = isAdminEmail || profile?.role === "admin";
  if (!isAuthorized) {
    redirect("/member");
  }

  const adminProfile = profile || {
    id: user.id,
    auth_user_id: user.id,
    full_name: user.email?.split("@")[0] || "Gym Admin",
    member_code: "ADM-001",
    role: "admin",
  };

  // 1. Total Members Count (Safely try adminClient, then supabase)
  let totalMembers = 0;
  try {
    const adminClient = createAdminClient();
    const { count } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "member");
    if (count !== null) totalMembers = count;
  } catch {}

  if (totalMembers === 0) {
    try {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (count !== null) totalMembers = count;
    } catch {}
  }

  // 2. Today's Punches
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  let todayPunches: AttendanceRecord[] = [];
  try {
    const adminClient = createAdminClient();
    const { data: punches } = await adminClient
      .from("attendance")
      .select("*, profiles (full_name, member_code, phone)")
      .gte("punch_time", startOfDay)
      .order("punch_time", { ascending: false });
    if (punches) todayPunches = punches as unknown as AttendanceRecord[];
  } catch {}

  if (todayPunches.length === 0) {
    try {
      const { data: punches } = await supabase
        .from("attendance")
        .select("*, profiles (full_name, member_code, phone)")
        .gte("punch_time", startOfDay)
        .order("punch_time", { ascending: false });
      if (punches) todayPunches = punches as unknown as AttendanceRecord[];
    } catch {}
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar
        userRole="admin"
        memberName={adminProfile.full_name}
        memberCode={adminProfile.member_code}
      />

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
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
