import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import AttendanceList from "@/components/AttendanceList";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import type { AttendanceRecord } from "@/types/attendance";

export default async function MemberAttendancePage() {
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

  // Fetch full attendance history for this user
  const { data: records } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user.id)
    .order("punch_time", { ascending: false });

  // Separate today's punches from previous days
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const allRecords = (records as AttendanceRecord[]) || [];
  const todayRecords = allRecords.filter(
    (r) => new Date(r.punch_time).getTime() >= startOfDay
  );
  const pastRecords = allRecords.filter(
    (r) => new Date(r.punch_time).getTime() < startOfDay
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar
        userRole={profile?.role || "member"}
        memberName={profile?.full_name || "Gym Member"}
        memberCode={profile?.member_code || "GYM-0001"}
      />

      <main className="mobile-container py-6 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/member"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-xs font-mono text-emerald-400">
            {profile?.member_code || "GYM-0001"}
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-black text-white uppercase tracking-tight">
            Attendance Log
          </h1>
          <p className="text-xs text-slate-400">
            Complete record of your gym visits and mobile biometric punches.
          </p>
        </div>

        {/* Today's Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Today&apos;s Attendance</span>
          </h2>
          <AttendanceList records={todayRecords} todayOnly={true} />
        </div>

        {/* Previous Days Section */}
        {pastRecords.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-800/80">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Previous Visits
            </h2>
            <AttendanceList records={pastRecords} todayOnly={false} />
          </div>
        )}
      </main>
    </div>
  );
}
