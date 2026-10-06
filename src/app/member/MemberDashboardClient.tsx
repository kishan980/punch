"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PunchButton from "@/components/PunchButton";
import AttendanceList from "@/components/AttendanceList";
import type { AttendanceRecord, Profile } from "@/types/attendance";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Smartphone,
  CheckCircle,
  Clock,
  ArrowRight,
  Activity,
} from "lucide-react";

interface MemberDashboardClientProps {
  profile: Profile;
  credentialCount: number;
  initialTodayPunches: AttendanceRecord[];
}

export default function MemberDashboardClient({
  profile,
  credentialCount,
  initialTodayPunches,
}: MemberDashboardClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [punches, setPunches] = useState<AttendanceRecord[]>(initialTodayPunches);
  const [currentTime, setCurrentTime] = useState<string>("");

  // 1. Live Digital Terminal Clock (Ticking every second)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Supabase Realtime Subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel("member-attendance-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance",
          filter: `user_id=eq.${profile.auth_user_id}`,
        },
        (payload) => {
          setPunches((prev) => [...prev, payload.new as AttendanceRecord]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.auth_user_id, supabase]);

  // Compute punch status for today
  const latestPunch = punches.length > 0 ? punches[punches.length - 1] : null;
  const isPunchedIn = latestPunch?.punch_type === "in";

  const firstIn = punches.find((p) => p.punch_type === "in");
  const lastOut = [...punches].reverse().find((p) => p.punch_type === "out");

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const handlePunchSuccess = () => {
    router.push("/member/attendance");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Real-time Kiosk Clock Display */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 text-center shadow-xl backdrop-blur-md relative overflow-hidden">
        <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800/80">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>TERMINAL LIVE</span>
          </span>
          <span className="font-mono text-slate-400">
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        <div className="py-2">
          <div className="font-mono font-black text-3xl sm:text-4xl text-white tracking-wider">
            {currentTime || "--:--:--"}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Biometric Attendance Terminal</p>
        </div>
      </div>

      {/* Member Profile Badge Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-black text-white">{profile.full_name}</div>
              <div className="text-xs font-mono text-emerald-400 font-semibold">
                {profile.member_code}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">
              Membership
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                profile.status === "active"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
              }`}
            >
              {profile.status}
            </span>
          </div>
        </div>

        {/* Biometric Status Banner */}
        <div className="pt-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>
              Device:{" "}
              <strong className="text-white">
                {credentialCount > 0 ? "Passkey Linked ✅" : "Not Linked"}
              </strong>
            </span>
          </div>
          {credentialCount === 0 && (
            <Link
              href="/member/register-biometric"
              className="text-emerald-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>Link Phone</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Main Punch Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Today&apos;s Attendance Status
          </h2>

          {/* Punch Timestamps Summary */}
          {punches.length === 0 ? (
            <p className="text-xs text-slate-500 py-1">No punches recorded today.</p>
          ) : (
            <div className="py-2 space-y-1">
              {firstIn && (
                <div className="text-xs text-slate-300 flex items-center justify-center gap-2">
                  <span className="text-slate-500">Punched In:</span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    {formatTime(firstIn.punch_time)}
                  </strong>
                </div>
              )}
              {lastOut && (
                <div className="text-xs text-slate-300 flex items-center justify-center gap-2">
                  <span className="text-slate-500">Punched Out:</span>
                  <strong className="text-amber-400 font-mono text-sm">
                    {formatTime(lastOut.punch_time)}
                  </strong>
                </div>
              )}
              {!isPunchedIn && firstIn && (
                <div className="pt-2 text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>Attendance completed today</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Punch Button Section */}
        {credentialCount === 0 ? (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center space-y-3">
            <p className="font-semibold">
              Please link your phone&apos;s fingerprint/Face ID before punching.
            </p>
            <Link
              href="/member/register-biometric"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition-colors shadow-lg"
            >
              <span>Link Phone Biometric</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <PunchButton
            currentPunchType={isPunchedIn ? "out" : "in"}
            onSuccess={handlePunchSuccess}
          />
        )}
      </div>

      {/* Today's Punches Real-time List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Today&apos;s Logs</span>
          </h3>
          <Link
            href="/member/attendance"
            className="text-xs text-emerald-400 font-semibold hover:underline flex items-center gap-1"
          >
            <span>History</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <AttendanceList records={punches} todayOnly={true} />
      </div>
    </div>
  );
}
