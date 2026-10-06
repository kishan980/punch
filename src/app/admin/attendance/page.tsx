import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import AdminAttendanceExplorer from "./AdminAttendanceExplorer";
import type { AttendanceRecord } from "@/types/attendance";

export default async function AdminAttendancePage() {
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

  // Fetch all attendance logs joined with profile
  const { data: recordsRaw } = await supabase
    .from("attendance")
    .select("*, profiles (full_name, member_code, phone)")
    .order("punch_time", { ascending: false });

  const records = (recordsRaw as unknown as AttendanceRecord[]) || [];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar
        userRole="admin"
        memberName={adminProfile.full_name}
        memberCode={adminProfile.member_code}
      />

      <main className="max-w-4xl mx-auto w-full px-4 py-6 flex-1 space-y-6">
        <AdminAttendanceExplorer initialRecords={records} />
      </main>
    </div>
  );
}
