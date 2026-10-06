"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Fingerprint,
  Clock,
  User,
  ArrowRight,
  Activity,
  CheckCircle,
  Smartphone,
} from "lucide-react";
import type { AttendanceRecord, Profile } from "@/types/attendance";
import PunchButton from "@/components/PunchButton";
import AttendanceList from "@/components/AttendanceList";
import { createClient } from "@/lib/supabase/client";

interface MemberDashboardClientProps {
  profile: Profile;
  initialTodayPunches: AttendanceRecord[];
  credentialCount: number;
}

export default function MemberDashboardClient({
  profile,
  initialTodayPunches,
  credentialCount,
}: MemberDashboardClientProps) {
  const supabase = createClient();
  const [punches, setPunches] = useState<AttendanceRecord[]>(
    [...initialTodayPunches].sort(
      (a, b) => new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime()
    )
  );
  const [currentTime, setCurrentTime] = useState<string>("");

  // Digital clock
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
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Supabase Realtime Attendance Subscription
  useEffect(() => {
    const channel = supabase
      .channel("member-realtime-attendance")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance",
          filter: `user_id=eq.${profile.auth_user_id}`,
        },
        (payload) => {
          const newRecord = payload.new as AttendanceRecord;
          setPunches((prev) => [newRecord, ...prev.filter((p) => p.id !== newRecord.id)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.auth_user_id, supabase]);

  const latestPunch = punches[0];
  const isPunchedIn = latestPunch?.punch_type === "in";

  // Earliest IN & Latest OUT today
  const punchesAsc = [...punches].reverse();
  const firstIn = punchesAsc.find((p) => p.punch_type === "in");
  const lastOut = punches.find((p) => p.punch_type === "out");

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const handlePunchSuccess = () => {
    window.location.href = "/member/attendance";
  };

  return (
    <div className="space-y-6">
      {/* Real-time Kiosk Clock Display */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 text-center shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-800 pb-3 border-b-2 border-slate-200 font-bold">
          <span className="flex items-center gap-2 font-black text-emerald-800">
            <Activity className="w-4 h-4 animate-pulse" />
            <span className="tracking-wider">TERMINAL LIVE</span>
          </span>
          <span className="font-mono text-black font-black">
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        <div className="py-4">
          <div className="font-mono font-black text-5xl sm:text-6xl text-black tracking-tight">
            {currentTime || "--:--:--"}
          </div>
          <p className="text-xs text-slate-700 font-black uppercase tracking-wider mt-2">
            Biometric Attendance Terminal
          </p>
        </div>
      </div>

      {/* Member Profile Badge Card */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b-2 border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
              <User className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xl font-black text-black leading-tight">
                {profile.full_name}
              </div>
              <div className="text-sm font-mono text-emerald-800 font-black mt-0.5">
                {profile.member_code}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-slate-700 font-black block mb-1">
              Membership
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                profile.status === "active"
                  ? "bg-emerald-600 text-white"
                  : "bg-rose-600 text-white"
              }`}
            >
              {profile.status}
            </span>
          </div>
        </div>

        {/* Biometric Status Banner */}
        <div className="pt-4 flex items-center justify-between text-sm font-bold">
          <div className="flex items-center gap-2 text-slate-800">
            <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Device:{" "}
              <strong className="text-black font-black">
                {credentialCount > 0 ? "Passkey Linked ✅" : "Not Linked"}
              </strong>
            </span>
          </div>
          {credentialCount === 0 && (
            <Link
              href="/member/register-biometric"
              className="text-emerald-800 font-black hover:underline flex items-center gap-1.5"
            >
              <span>Link Phone</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Main Punch Section */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
        <div className="text-center space-y-1.5">
          <h2 className="text-xs font-black uppercase tracking-widest text-black">
            Today&apos;s Attendance Status
          </h2>

          {/* Punch Timestamps Summary */}
          {punches.length === 0 ? (
            <p className="text-sm text-slate-600 py-1.5 font-bold">No punches recorded today.</p>
          ) : (
            <div className="py-2.5 space-y-2">
              {firstIn && (
                <div className="text-sm text-black flex items-center justify-center gap-2">
                  <span className="text-slate-800 font-bold">Punched In:</span>
                  <strong className="text-emerald-800 font-mono text-base font-black">
                    {formatTime(firstIn.punch_time)}
                  </strong>
                </div>
              )}
              {lastOut && (
                <div className="text-sm text-black flex items-center justify-center gap-2">
                  <span className="text-slate-800 font-bold">Punched Out:</span>
                  <strong className="text-amber-800 font-mono text-base font-black">
                    {formatTime(lastOut.punch_time)}
                  </strong>
                </div>
              )}
              {!isPunchedIn && firstIn && (
                <div className="pt-2 text-xs font-black text-emerald-800 flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-700" />
                  <span>Attendance completed today</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Punch Button Section */}
        {credentialCount === 0 ? (
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-sm text-center space-y-3.5">
            <p className="font-bold">
              Please link your phone&apos;s Face ID or fingerprint before punching.
            </p>
            <Link
              href="/member/register-biometric"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition-colors shadow-md text-sm"
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
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Today&apos;s Logs</span>
          </h3>
          <Link
            href="/member/attendance"
            className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1.5"
          >
            <span>View History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <AttendanceList records={punches} todayOnly={true} />
      </div>
    </div>
  );
}
