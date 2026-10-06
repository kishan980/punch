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
        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-800 mb-1">
            <Users className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-black uppercase tracking-wider">
              Members
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-black font-mono">
            {totalMembers}
          </div>
        </div>

        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-800 mb-1">
            <Fingerprint className="w-4 h-4 text-teal-700" />
            <span className="text-xs font-black uppercase tracking-wider">
              Today&apos;s Punches
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-black font-mono">
            {punches.length}
          </div>
        </div>

        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-800 mb-1">
            <Activity className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-black uppercase tracking-wider">
              Inside Now
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
            {currentlyInsideCount}
          </div>
        </div>
      </div>

      {/* Today's Attendance Table with Live Stream */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-black uppercase tracking-wider text-black">
              Today&apos;s Live Punches
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-950 font-black bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
            <span>REALTIME</span>
          </span>
        </div>

        {punches.length === 0 ? (
          <p className="text-center py-8 text-sm text-slate-600 font-semibold">
            No punches recorded today yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100/90 border-b-2 border-slate-300 text-black uppercase tracking-wider text-xs">
                    <th className="py-3 px-3.5 font-black whitespace-nowrap">Member</th>
                    <th className="py-3 px-3.5 font-black whitespace-nowrap">Time</th>
                    <th className="py-3 px-3.5 font-black whitespace-nowrap">Type</th>
                    <th className="py-3 px-3.5 font-black whitespace-nowrap">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedPunches.map((record) => {
                    const isIn = record.punch_type === "in";
                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3.5 px-3.5 font-bold text-black whitespace-nowrap">
                          <div className="whitespace-nowrap text-sm font-black text-black">{record.profiles?.full_name || "Unknown Member"}</div>
                          <div className="text-xs font-mono font-bold text-emerald-800 whitespace-nowrap mt-0.5">
                            {record.profiles?.member_code}
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 font-mono font-black text-black whitespace-nowrap text-sm">
                          {formatTime(record.punch_time)}
                        </td>
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap ${
                              isIn
                                ? "bg-emerald-600 text-white"
                                : "bg-amber-500 text-slate-950"
                            }`}
                          >
                            {record.punch_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-3.5 text-black whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            {record.method === "mobile_biometric" ? (
                              <>
                                <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
                                <span className="whitespace-nowrap text-emerald-950 font-black">Mobile Biometric</span>
                              </>
                            ) : (
                              <>
                                <Cpu className="w-4 h-4 text-cyan-700 shrink-0" />
                                <span className="whitespace-nowrap text-cyan-950 font-black">{record.method}</span>
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
              <div className="bg-slate-100 border-2 border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm pt-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border-2 border-slate-300 text-black rounded-lg px-2.5 py-1 text-sm font-bold focus:outline-none focus:border-emerald-600"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span>per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-800 font-mono text-sm font-semibold">
                    Page <strong className="text-black text-sm font-black">{safePage}</strong> of{" "}
                    <strong className="text-black text-sm font-black">{totalPages}</strong>
                  </span>

                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
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
