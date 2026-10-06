"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Fingerprint,
  Activity,
  Clock,
  Smartphone,
  Cpu,
  Radio,
  ChevronLeft,
  ChevronRight,
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

          // Sound alert on live scan
          soundEffects.playPunchSuccess();

          setPunches((prev) => [
            newRecord,
            ...prev.filter((p) => p.id !== newRecord.id),
          ]);

          const action = newRecord.punch_type === "in" ? "PUNCHED IN" : "PUNCHED OUT";
          setLiveEventNotice(
            `🔔 ${newRecord.profiles?.full_name || "Member"} ${action} at ${new Date(
              newRecord.punch_time
            ).toLocaleTimeString()}`
          );

          // Clear notice after 5 seconds
          setTimeout(() => {
            setLiveEventNotice(null);
          }, 5000);
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

  // Pagination state for Today's Live Punches table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(punches.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPunches = punches.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-6">
      {/* Live Activity Notification Banner */}
      {liveEventNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-3 shadow-md">
          <Radio className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
          <span>{liveEventNotice}</span>
        </div>
      )}

      {/* Top 3 KPI Metric Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Users className="w-4 h-4 text-emerald-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Members
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {totalMembers}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Fingerprint className="w-4 h-4 text-teal-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Today&apos;s Punches
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {punches.length}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Inside Now
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
            {currentlyInsideCount}
          </div>
        </div>
      </div>

      {/* Today's Attendance Table with Live Stream */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Today&apos;s Live Punches
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>REALTIME</span>
          </span>
        </div>

        {punches.length === 0 ? (
          <p className="text-center py-8 text-xs text-slate-400">
            No punches recorded today yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="min-w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Member</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Time</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPunches.map((record) => {
                    const isIn = record.punch_type === "in";
                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          <div className="whitespace-nowrap">{record.profiles?.full_name || "Unknown Member"}</div>
                          <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                            {record.profiles?.member_code}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-600 whitespace-nowrap">
                          {formatTime(record.punch_time)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                              isIn
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {record.punch_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] whitespace-nowrap font-medium">
                            {record.method === "mobile_biometric" ? (
                              <>
                                <Smartphone className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="whitespace-nowrap text-emerald-800">Mobile Biometric</span>
                              </>
                            ) : (
                              <>
                                <Cpu className="w-3 h-3 text-cyan-600 shrink-0" />
                                <span className="whitespace-nowrap text-cyan-800">{record.method}</span>
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

            {/* PAGINATION CONTROLS BAR */}
            {totalPages > 1 && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs pt-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:border-emerald-600"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span>per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono text-[11px]">
                    Page <strong className="text-slate-900">{safePage}</strong> of{" "}
                    <strong className="text-slate-900">{totalPages}</strong>
                  </span>

                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous Page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next Page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
