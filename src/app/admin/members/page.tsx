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

  // 3. Fetch current month punches to see full month and today workout duration
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let monthPunches: Array<{ user_id: string; punch_type: string; punch_time: string }> = [];
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("attendance")
      .select("user_id, punch_type, punch_time")
      .gte("punch_time", startOfMonth)
      .order("punch_time", { ascending: true });
    if (data) monthPunches = data;
  } catch {}

  if (monthPunches.length === 0) {
    try {
      const { data } = await supabase
        .from("attendance")
        .select("user_id, punch_type, punch_time")
        .gte("punch_time", startOfMonth)
        .order("punch_time", { ascending: true });
      if (data) monthPunches = data;
    } catch {}
  }

  // Compute User-Wise Punch IN and OUT details, Month Duration & Today Duration
  const userPunchMap: Record<
    string,
    {
      firstInTime: string | null;
      lastOutTime: string | null;
      latestType: string | null;
      monthHoursDisplay: string;
      monthDaysCount: number;
      todayHoursDisplay: string;
      isInside: boolean;
    }
  > = {};

  // Group punches by user
  const punchesByUser: Record<string, typeof monthPunches> = {};
  monthPunches?.forEach((p) => {
    if (!punchesByUser[p.user_id]) punchesByUser[p.user_id] = [];
    punchesByUser[p.user_id].push(p);
  });

  const todayIsoDate = startOfDay.split("T")[0];

  Object.entries(punchesByUser).forEach(([userId, userPunches]) => {
    // Latest punch overall
    const latestPunch = userPunches[userPunches.length - 1];
    const isInside = latestPunch?.punch_type === "in";

    // Pairwise calculation for whole month
    let totalMonthDurationMs = 0;
    let activeInTime: number | null = null;

    // Pairwise calculation for today only
    let totalTodayDurationMs = 0;
    let todayActiveInTime: number | null = null;

    userPunches.forEach((p) => {
      const time = new Date(p.punch_time).getTime();
      const isToday = p.punch_time >= startOfDay;

      // Month pairwise
      if (p.punch_type === "in") {
        if (activeInTime === null) activeInTime = time;
      } else if (p.punch_type === "out") {
        if (activeInTime !== null) {
          totalMonthDurationMs += Math.max(0, time - activeInTime);
          activeInTime = null;
        }
      }

      // Today pairwise
      if (isToday) {
        if (p.punch_type === "in") {
          if (todayActiveInTime === null) todayActiveInTime = time;
        } else if (p.punch_type === "out") {
          if (todayActiveInTime !== null) {
            totalTodayDurationMs += Math.max(0, time - todayActiveInTime);
            todayActiveInTime = null;
          }
        }
      }
    });

    if (activeInTime !== null && isInside) {
      totalMonthDurationMs += Math.max(0, Date.now() - activeInTime);
    }
    if (todayActiveInTime !== null && isInside) {
      totalTodayDurationMs += Math.max(0, Date.now() - todayActiveInTime);
    }

    // Format Month hours
    const monthMinsTotal = Math.floor(totalMonthDurationMs / 60000);
    const mHrs = Math.floor(monthMinsTotal / 60);
    const mMins = monthMinsTotal % 60;
    const mDecimal = (monthMinsTotal / 60).toFixed(1);
    const monthDaysCount = new Set(
      userPunches.map((p) => p.punch_time.split("T")[0])
    ).size;

    let monthHoursDisplay = "0 hrs";
    if (monthMinsTotal > 0) {
      monthHoursDisplay = mHrs > 0 ? `${mHrs}h ${mMins}m (${mDecimal} hrs)` : `${mMins}m (${mDecimal} hrs)`;
    }

    // Format Today hours
    const todayPunches = userPunches.filter((p) => p.punch_time >= startOfDay);
    const todayFirstIn = todayPunches.find((p) => p.punch_type === "in");
    const todayLastOut = [...todayPunches].reverse().find((p) => p.punch_type === "out");

    const todayMinsTotal = Math.floor(totalTodayDurationMs / 60000);
    const tHrs = Math.floor(todayMinsTotal / 60);
    const tMins = todayMinsTotal % 60;
    const tDecimal = (todayMinsTotal / 60).toFixed(1);

    let todayHoursDisplay = "0 hrs";
    if (todayMinsTotal > 0) {
      todayHoursDisplay = tHrs > 0 ? `${tHrs}h ${tMins}m` : `${tMins}m`;
    } else if (todayFirstIn) {
      todayHoursDisplay = "< 1m";
    }

    userPunchMap[userId] = {
      firstInTime: todayFirstIn?.punch_time || null,
      lastOutTime: todayLastOut?.punch_time || null,
      latestType: latestPunch?.punch_type || null,
      monthHoursDisplay,
      monthDaysCount,
      todayHoursDisplay,
      isInside,
    };
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
