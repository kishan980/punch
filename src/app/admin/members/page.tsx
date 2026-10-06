import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Navbar from "@/components/Navbar";
import AdminMembersClient from "./AdminMembersClient";
import type { Profile } from "@/types/attendance";

export default async function AdminMembersPage() {
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

  // 1. Fetch all member profiles
  const { data: members } = await adminClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  // 2. Fetch all credentials to see which members have registered biometrics
  const { data: credentials } = await adminClient
    .from("webauthn_credentials")
    .select("user_id");

  const registeredUserIds = credentials?.map((c) => c.user_id) || [];

  // 3. Fetch today's punches to see today's user-wise IN & OUT times
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: todayPunches } = await adminClient
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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar
        userRole="admin"
        memberName={safeAdminProfile.full_name}
        memberCode={safeAdminProfile.member_code}
      />

      <main className="max-w-4xl mx-auto w-full px-4 py-6 flex-1 space-y-6">
        <AdminMembersClient
          members={(members as Profile[]) || []}
          registeredUserIds={registeredUserIds}
          userPunchMap={userPunchMap}
        />
      </main>
    </div>
  );
}
