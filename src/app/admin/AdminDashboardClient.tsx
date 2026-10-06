"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Fingerprint,
  Activity,
  ArrowRight,
  Clock,
  Smartphone,
  Cpu,
  Radio,
} from "lucide-react";
import type { AttendanceRecord, Profile } from "@/types/attendance";
import { createClient } from "@/lib/supabase/client";
import { soundEffects } from "@/lib/audio";

interface AdminDashboardClientProps {
  initialTotalMembers: number;
  initialTodayPunches: AttendanceRecord[];
}

export default function AdminDashboardClient({
  initialTotalMembers,
  initialTodayPunches,
}: AdminDashboardClientProps) {
  const supabase = createClient();
  const [punches, setPunches] = useState<AttendanceRecord[]>(
    [...initialTodayPunches].sort(
      (a, b) => new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime()
    )
  );
  const [totalMembers] = useState(initialTotalMembers);
  const [liveEventNotice, setLiveEventNotice] = useState<string | null>(null);

  // 1. Supabase Realtime Channel
  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime-attendance")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance",
        },
        async (payload) => {
          const newRecord = payload.new as AttendanceRecord;

          // Fetch member profile details to display member name
          const { data: memberProfile } = await supabase
            .from("profiles")
            .select("full_name, member_code, phone")
            .eq("id", newRecord.member_id)
            .single();

          if (memberProfile) {
            newRecord.profiles = memberProfile;
          }

          // Sound alert for admin terminal
          soundEffects.playPunchSuccess();

          // Flash live toast notice
          setLiveEventNotice(
            `Live Punch: ${newRecord.profiles?.full_name || "Member"} just punched ${newRecord.punch_type.toUpperCase()}!`
          );
          setTimeout(() => setLiveEventNotice(null), 4000);

          setPunches((prev) => [newRecord, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Compute Currently Inside
  const memberLatestPunch: Record<string, string> = {};
  const punchesAsc = [...punches].reverse();
  punchesAsc.forEach((p) => {
    memberLatestPunch[p.member_id] = p.punch_type;
  });

  const currentlyInsideCount = Object.values(memberLatestPunch).filter(
    (type) => type === "in"
  ).length;

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Activity Notification Banner */}
      {liveEventNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-3 animate-bounce-short shadow-xl">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
          <span>{liveEventNotice}</span>
        </div>
      )}

      {/* Top 3 KPI Metric Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Members
            </span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {totalMembers}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Fingerprint className="w-4 h-4 text-teal-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Today&apos;s Punches
            </span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {punches.length}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Inside Now
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {currentlyInsideCount}
          </div>
        </div>
      </div>

      {/* Today's Attendance Table with Live Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Today&apos;s Live Punches
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>REALTIME</span>
          </span>
        </div>

        {punches.length === 0 ? (
          <p className="text-center py-8 text-xs text-slate-500">
            No punches recorded today yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="pb-2.5 font-bold">Member</th>
                  <th className="pb-2.5 font-bold">Time</th>
                  <th className="pb-2.5 font-bold">Type</th>
                  <th className="pb-2.5 font-bold">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {punches.slice(0, 15).map((record) => {
                  const isIn = record.punch_type === "in";
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-800/30 transition-colors animate-fadeIn"
                    >
                      <td className="py-3 font-semibold text-slate-200">
                        <div>{record.profiles?.full_name || "Unknown Member"}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {record.profiles?.member_code}
                        </div>
                      </td>
                      <td className="py-3 font-mono text-slate-300">
                        {formatTime(record.punch_time)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isIn
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {record.punch_type}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          {record.method === "mobile_biometric" ? (
                            <>
                              <Smartphone className="w-3 h-3 text-emerald-400" />
                              <span>Mobile Biometric</span>
                            </>
                          ) : (
                            <>
                              <Cpu className="w-3 h-3 text-cyan-400" />
                              <span>{record.method}</span>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
