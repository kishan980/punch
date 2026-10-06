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

  const adminClient = createAdminClient();
  const isAdminEmail = user.email?.toLowerCase().includes("admin");

  let { data: adminProfile } = await adminClient
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (isAdminEmail && adminProfile?.role !== "admin") {
    const { data: updatedProfile } = await adminClient
      .from("profiles")
      .upsert(
        {
          auth_user_id: user.id,
          full_name: adminProfile?.full_name || user.email?.split("@")[0] || "Gym Admin",
          member_code: adminProfile?.member_code?.startsWith("ADM-") ? adminProfile.member_code : "ADM-001",
          role: "admin",
          status: "active",
        },
        { onConflict: "auth_user_id" }
      )
      .select()
      .single();
    if (updatedProfile) {
      adminProfile = updatedProfile;
    }
  }

  if (adminProfile?.role !== "admin") {
    redirect("/member");
  }

  const safeAdminProfile = adminProfile || {
    id: user.id,
    auth_user_id: user.id,
    full_name: "Gym Admin",
    member_code: "ADM-001",
    role: "admin",
  };

  // Fetch all attendance logs joined with profile
  const { data: recordsRaw } = await adminClient
    .from("attendance")
    .select("*, profiles (full_name, member_code, phone)")
    .order("punch_time", { ascending: false });

  const records = (recordsRaw as unknown as AttendanceRecord[]) || [];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar
        userRole="admin"
        memberName={safeAdminProfile.full_name}
        memberCode={safeAdminProfile.member_code}
      />

      <main className="max-w-4xl mx-auto w-full px-4 py-6 flex-1 space-y-6">
        <AdminAttendanceExplorer initialRecords={records} />
      </main>
    </div>
  );
}
