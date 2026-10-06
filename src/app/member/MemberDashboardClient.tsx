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
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const handlePunchSuccess = () => {
    window.location.href = "/member/attendance";
  };

  return (
    <div className="space-y-5">
      {/* Real-time Kiosk Clock Display */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 text-center shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-[11px] text-slate-500 pb-3 border-b border-slate-100">
          <span className="flex items-center gap-1.5 font-bold text-emerald-600">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>TERMINAL LIVE</span>
          </span>
          <span className="font-mono text-slate-500 font-semibold">
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        <div className="py-3">
          <div className="font-mono font-black text-4xl sm:text-5xl text-slate-900 tracking-tight">
            {currentTime || "--:--:--"}
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-1">Biometric Attendance Terminal</p>
        </div>
      </div>

      {/* Member Profile Badge Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900">{profile.full_name}</div>
              <div className="text-xs font-mono text-emerald-600 font-bold">
                {profile.member_code}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
              Membership
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                profile.status === "active"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {profile.status}
            </span>
          </div>
        </div>

        {/* Biometric Status Banner */}
        <div className="pt-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>
              Device:{" "}
              <strong className="text-slate-900">
                {credentialCount > 0 ? "Passkey Linked ✅" : "Not Linked"}
              </strong>
            </span>
          </div>
          {credentialCount === 0 && (
            <Link
              href="/member/register-biometric"
              className="text-emerald-600 font-bold hover:underline flex items-center gap-1"
            >
              <span>Link Phone</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Main Punch Section */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Today&apos;s Attendance Status
          </h2>

          {/* Punch Timestamps Summary */}
          {punches.length === 0 ? (
            <p className="text-xs text-slate-400 py-1">No punches recorded today.</p>
          ) : (
            <div className="py-2 space-y-1">
              {firstIn && (
                <div className="text-xs text-slate-600 flex items-center justify-center gap-2">
                  <span className="text-slate-400">Punched In:</span>
                  <strong className="text-emerald-600 font-mono text-sm">
                    {formatTime(firstIn.punch_time)}
                  </strong>
                </div>
              )}
              {lastOut && (
                <div className="text-xs text-slate-600 flex items-center justify-center gap-2">
                  <span className="text-slate-400">Punched Out:</span>
                  <strong className="text-amber-600 font-mono text-sm">
                    {formatTime(lastOut.punch_time)}
                  </strong>
                </div>
              )}
              {!isPunchedIn && firstIn && (
                <div className="pt-2 text-xs font-bold text-emerald-600 flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>Attendance completed today</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Punch Button Section */}
        {credentialCount === 0 ? (
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-center space-y-3">
            <p className="font-bold">
              Please link your phone&apos;s Face ID or fingerprint before punching.
            </p>
            <Link
              href="/member/register-biometric"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition-colors shadow-md"
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Today&apos;s Logs</span>
          </h3>
          <Link
            href="/member/attendance"
            className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
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
