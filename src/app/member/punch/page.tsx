import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import MemberDashboardClient from "../MemberDashboardClient";
import type { AttendanceRecord, Profile } from "@/types/attendance";

export default async function MemberPunchPage() {
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

  const memberProfile: Profile = profile || {
    id: user.id,
    auth_user_id: user.id,
    full_name: user.email?.split("@")[0] || "Gym Member",
    member_code: "GYM-0001",
    phone: null,
    role: "member",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { count: credentialCount } = await supabase
    .from("webauthn_credentials")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: todayPunches } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user.id)
    .gte("punch_time", startOfDay)
    .order("punch_time", { ascending: false });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar
        userRole={memberProfile.role}
        memberName={memberProfile.full_name}
        memberCode={memberProfile.member_code}
      />

      <main className="mobile-container py-6 flex-1">
        <MemberDashboardClient
          profile={memberProfile}
          credentialCount={credentialCount || 0}
          initialTodayPunches={(todayPunches as AttendanceRecord[]) || []}
        />
      </main>
    </div>
  );
}
