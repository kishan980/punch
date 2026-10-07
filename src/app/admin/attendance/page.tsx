import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const isAdminEmail = Boolean(
    user.email?.toLowerCase().includes("admin") ||
    user.email?.toLowerCase().includes("owner") ||
    user.email?.toLowerCase().includes("manager")
  );

  let { data: adminProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!adminProfile) {
    try {
      const adminClient = createAdminClient();
      const { data: ap } = await adminClient
        .from("profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();
      if (ap) adminProfile = ap;
    } catch {}
  }

  const isAuthorized = isAdminEmail || adminProfile?.role === "admin";
  if (!isAuthorized) {
    redirect("/member");
  }

  const safeAdminProfile = adminProfile || {
    id: user.id,
    auth_user_id: user.id,
    full_name: user.email?.split("@")[0] || "Gym Admin",
    member_code: "ADM-001",
    role: "admin",
  };

  // Fetch all attendance logs joined with profile (Try adminClient, then supabase)
  let records: AttendanceRecord[] = [];
  try {
    const adminClient = createAdminClient();
    const { data: recordsRaw } = await adminClient
      .from("attendance")
      .select("*, profiles (full_name, member_code, phone)")
      .order("punch_time", { ascending: false });
    if (recordsRaw) records = recordsRaw as unknown as AttendanceRecord[];
  } catch {}

  if (records.length === 0) {
    try {
      const { data: recordsRaw } = await supabase
        .from("attendance")
        .select("*, profiles (full_name, member_code, phone)")
        .order("punch_time", { ascending: false });
      if (recordsRaw) records = recordsRaw as unknown as AttendanceRecord[];
    } catch {}
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar
        userRole="admin"
        memberName={safeAdminProfile.full_name}
        memberCode={safeAdminProfile.member_code}
      />

      <main className="max-w-6xl mx-auto w-full px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 space-y-4 sm:space-y-6">
        <AdminAttendanceExplorer initialRecords={records} />
      </main>
    </div>
  );
}
