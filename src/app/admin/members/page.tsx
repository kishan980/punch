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

  // 1. Fetch all member profiles (Try adminClient, then supabase)
  let members: Profile[] = [];
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) members = data as Profile[];
  } catch {}

  if (members.length === 0) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (data) members = data as Profile[];
    } catch {}
  }

  // 2. Fetch all credentials to see which members have registered biometrics
  let registeredUserIds: string[] = [];
  try {
    const adminClient = createAdminClient();
    const { data: credentials } = await adminClient
      .from("webauthn_credentials")
      .select("user_id");
    if (credentials) registeredUserIds = credentials.map((c) => c.user_id);
  } catch {}

  if (registeredUserIds.length === 0) {
    try {
      const { data: credentials } = await supabase
        .from("webauthn_credentials")
        .select("user_id");
      if (credentials) registeredUserIds = credentials.map((c) => c.user_id);
    } catch {}
  }

  // 3. Fetch today's punches to see today's user-wise IN & OUT times
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  let todayPunches: Array<{ user_id: string; punch_type: string; punch_time: string }> = [];
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("attendance")
      .select("user_id, punch_type, punch_time")
      .gte("punch_time", startOfDay)
      .order("punch_time", { ascending: true });
    if (data) todayPunches = data;
  } catch {}

  if (todayPunches.length === 0) {
    try {
      const { data } = await supabase
        .from("attendance")
        .select("user_id, punch_type, punch_time")
        .gte("punch_time", startOfDay)
        .order("punch_time", { ascending: true });
      if (data) todayPunches = data;
    } catch {}
  }

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

      <main className="max-w-6xl mx-auto w-full px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 space-y-4 sm:space-y-6">
        <AdminMembersClient
          members={(members as Profile[]) || []}
          registeredUserIds={registeredUserIds}
          userPunchMap={userPunchMap}
        />
      </main>
    </div>
  );
}
