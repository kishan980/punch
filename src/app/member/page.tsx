import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Navbar from "@/components/Navbar";
import MemberDashboardClient from "./MemberDashboardClient";
import type { AttendanceRecord, Profile } from "@/types/attendance";

export default async function MemberDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch Member Profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  // If profile doesn't exist yet, auto-create using server admin client to avoid RLS block
  if (!profile) {
    try {
      const adminClient = createAdminClient();
      const defaultCode = `GYM-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: newProfile } = await adminClient
        .from("profiles")
        .upsert(
          {
            auth_user_id: user.id,
            full_name: user.email?.split("@")[0] || "Gym Member",
            member_code: defaultCode,
            role: "member",
            status: "active",
          },
          { onConflict: "auth_user_id" }
        )
        .select()
        .single();

      if (newProfile) {
        profile = newProfile;
      }
    } catch (err) {
      console.error("Error auto-creating profile:", err);
    }
  }

  // Bulletproof fallback so memberProfile is never null
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

  // Count registered biometric credentials
  const { count: credentialCount } = await supabase
    .from("webauthn_credentials")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Fetch today's punches
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
        userRole={memberProfile.role || "member"}
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
