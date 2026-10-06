"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  Smartphone,
  Cpu,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Clock,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { AttendanceRecord } from "@/types/attendance";

interface AdminAttendanceExplorerProps {
  initialRecords: AttendanceRecord[];
}

export default function AdminAttendanceExplorer({
  initialRecords,
}: AdminAttendanceExplorerProps) {
  const [viewMode, setViewMode] = useState<"user-wise" | "logs">("user-wise");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPunchType, setSelectedPunchType] = useState<string>("all");
  const [selectedMethod, setSelectedMethod] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Unique members list for dropdown
  const memberOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    initialRecords.forEach((r) => {
      if (r.member_id && !map.has(r.member_id)) {
        map.set(r.member_id, {
          id: r.member_id,
          name: r.profiles?.full_name || "Unknown Member",
          code: r.profiles?.member_code || "",
        });
      }
    });
    return Array.from(map.values());
  }, [initialRecords]);

  // Reset page when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  // 1. Filtered Raw Records (Always sorted newest first)
  const filteredRecords = useMemo(() => {
    return initialRecords
      .filter((record) => {
        // Search filter
        const memberName = record.profiles?.full_name?.toLowerCase() || "";
        const memberCode = record.profiles?.member_code?.toLowerCase() || "";
        const query = search.toLowerCase();
        if (search && !memberName.includes(query) && !memberCode.includes(query)) {
          return false;
        }

        // Member dropdown filter
        if (selectedMember !== "all" && record.member_id !== selectedMember) {
          return false;
        }

        // Date filter
        if (selectedDate) {
          const recordDate = new Date(record.punch_time).toISOString().split("T")[0];
          if (recordDate !== selectedDate) {
            return false;
          }
        }

        // Punch type filter
        if (selectedPunchType !== "all" && record.punch_type !== selectedPunchType) {
          return false;
        }

        // Method filter
        if (selectedMethod !== "all" && record.method !== selectedMethod) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) => new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime()
      );
  }, [
    initialRecords,
    search,
    selectedMember,
    selectedDate,
    selectedPunchType,
    selectedMethod,
  ]);

  // 2. Grouped User-Wise Summary Data
  const userWiseData = useMemo(() => {
    const userMap = new Map<
      string,
      {
        memberId: string;
        fullName: string;
        memberCode: string;
        phone?: string;
        punches: AttendanceRecord[];
      }
    >();

    filteredRecords.forEach((record) => {
      const mid = record.member_id;
      if (!userMap.has(mid)) {
        userMap.set(mid, {
          memberId: mid,
          fullName: record.profiles?.full_name || "Unknown Member",
          memberCode: record.profiles?.member_code || "",
          phone: record.profiles?.phone,
          punches: [],
        });
      }
      userMap.get(mid)!.punches.push(record);
    });

    return Array.from(userMap.values()).map((u) => {
      // Punches are sorted newest first
      const latestPunch = u.punches[0];
      const isInside = latestPunch?.punch_type === "in";

      // Earliest punch in today
      const punchesAsc = [...u.punches].reverse();
      const firstIn = punchesAsc.find((p) => p.punch_type === "in");
      const lastOut = u.punches.find((p) => p.punch_type === "out");

      // Calculate active workout duration
      let durationStr = "—";
      if (firstIn) {
        const start = new Date(firstIn.punch_time).getTime();
        const end = lastOut
          ? new Date(lastOut.punch_time).getTime()
          : isInside
          ? Date.now()
          : start;
        const diffMins = Math.max(0, Math.floor((end - start) / 60000));
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      }

      return {
        ...u,
        isInside,
        firstInTime: firstIn?.punch_time || null,
        lastOutTime: lastOut?.punch_time || null,
        durationStr,
      };
    });
  }, [filteredRecords]);

  // Paginated Slices
  const totalItems = viewMode === "user-wise" ? userWiseData.length : filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedUserWise = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return userWiseData.slice(start, start + pageSize);
  }, [userWiseData, safePage, pageSize]);

  const paginatedLogs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, safePage, pageSize]);

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return "—";
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

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">
            {totalItems} {viewMode === "user-wise" ? "Members" : "Punches"}
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-black text-white uppercase tracking-tight">
          Admin Attendance Explorer
        </h1>
        <p className="text-xs text-slate-400">
          User-wise punch analysis, live in/out tracking, and filterable punch logs.
        </p>
      </div>

      {/* View Mode Toggle: User-Wise vs All Logs */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        <button
          onClick={() => {
            setViewMode("user-wise");
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            viewMode === "user-wise"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/50"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User-Wise Punch Summary</span>
        </button>

        <button
          onClick={() => {
            setViewMode("logs");
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            viewMode === "logs"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/50"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>All Raw Logs Stream</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Member Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search member name/code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handleFilterChange();
              }}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Member Dropdown Filter */}
          <div>
            <select
              value={selectedMember}
              onChange={(e) => {
                setSelectedMember(e.target.value);
                handleFilterChange();
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Members ({memberOptions.length})</option>
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code})
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                handleFilterChange();
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Punch Type (Only relevant in logs view) */}
          <div>
            <select
              value={selectedPunchType}
              onChange={(e) => {
                setSelectedPunchType(e.target.value);
                handleFilterChange();
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Punch Types (IN &amp; OUT)</option>
              <option value="in">IN Only</option>
              <option value="out">OUT Only</option>
            </select>
          </div>
        </div>

        {/* Reset Filters Bar */}
        {(search ||
          selectedMember !== "all" ||
          selectedDate ||
          selectedPunchType !== "all" ||
          selectedMethod !== "all") && (
          <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800/80">
            <span className="text-slate-400">Filters applied</span>
            <button
              onClick={() => {
                setSearch("");
                setSelectedMember("all");
                setSelectedDate("");
                setSelectedPunchType("all");
                setSelectedMethod("all");
                setCurrentPage(1);
              }}
              className="text-emerald-400 hover:underline font-semibold"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* MAIN DATA VIEW */}
      {viewMode === "user-wise" ? (
        /* USER-WISE VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>User-Wise Punch In &amp; Out Status</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Showing {paginatedUserWise.length} of {userWiseData.length} members
            </span>
          </div>

          {paginatedUserWise.length === 0 ? (
            <p className="text-center py-12 text-xs text-slate-500">
              No member attendance found for the selected filters.
            </p>
          ) : (
            <div className="space-y-3">
              {paginatedUserWise.map((user) => {
                const isExpanded = expandedUser === user.memberId;
                return (
                  <div
                    key={user.memberId}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3"
                  >
                    {/* User Summary Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 overflow-x-auto scrollbar-thin pb-1">
                      <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="whitespace-nowrap">
                          <div className="font-bold text-sm text-white whitespace-nowrap">
                            {user.fullName}
                          </div>
                          <div className="text-[11px] font-mono text-emerald-400 whitespace-nowrap">
                            {user.memberCode} {user.phone ? `• ${user.phone}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* Status Badges in single line */}
                      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                        {/* IN Time */}
                        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-center min-w-[95px] shrink-0 whitespace-nowrap">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold flex items-center justify-center gap-1 whitespace-nowrap">
                            <LogIn className="w-2.5 h-2.5 text-emerald-400" />
                            <span>PUNCH IN</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {formatTime(user.firstInTime)}
                          </span>
                        </div>

                        {/* OUT Time */}
                        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-center min-w-[95px] shrink-0 whitespace-nowrap">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold flex items-center justify-center gap-1 whitespace-nowrap">
                            <LogOut className="w-2.5 h-2.5 text-amber-400" />
                            <span>PUNCH OUT</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-400 whitespace-nowrap">
                            {user.lastOutTime ? formatTime(user.lastOutTime) : "—"}
                          </span>
                        </div>

                        {/* Current Status Badge */}
                        <div className="text-center min-w-[110px] shrink-0 whitespace-nowrap">
                          <span
                            className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 whitespace-nowrap ${
                              user.isInside
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : user.lastOutTime
                                ? "bg-slate-800 text-slate-300 border border-slate-700"
                                : "bg-slate-900 text-slate-500"
                            }`}
                          >
                            {user.isInside && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            )}
                            <span className="whitespace-nowrap">{user.isInside ? "INSIDE GYM" : "PUNCHED OUT"}</span>
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-1 font-mono whitespace-nowrap">
                            Duration: {user.durationStr}
                          </span>
                        </div>

                        {/* Expand Detailed Punches Toggle */}
                        <button
                          onClick={() =>
                            setExpandedUser(isExpanded ? null : user.memberId)
                          }
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
                          title="View all punches"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Individual Punches Breakdown */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-800/80 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Detailed Punch Stream ({user.punches.length} events):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {user.punches.map((p) => (
                            <div
                              key={p.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                                p.punch_type === "in"
                                  ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                                  : "bg-amber-950/30 border-amber-500/30 text-amber-300"
                              }`}
                            >
                              <div className="flex items-center gap-2 font-bold">
                                {p.punch_type === "in" ? (
                                  <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <LogOut className="w-3.5 h-3.5 text-amber-400" />
                                )}
                                <span>{p.punch_type.toUpperCase()}</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({formatDate(p.punch_time)})
                                </span>
                              </div>
                              <span className="font-mono font-bold">
                                {formatTime(p.punch_time)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ALL RAW LOGS STREAM VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>All Punches (Latest Insert First)</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Showing {paginatedLogs.length} of {filteredRecords.length} records
            </span>
          </div>

          {paginatedLogs.length === 0 ? (
            <p className="text-center py-12 text-xs text-slate-500">
              No punch records match your filter criteria.
            </p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="min-w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3 font-bold whitespace-nowrap">Member</th>
                    <th className="py-3 px-3 font-bold whitespace-nowrap">Date</th>
                    <th className="py-3 px-3 font-bold whitespace-nowrap">Time</th>
                    <th className="py-3 px-3 font-bold whitespace-nowrap">Punch Type</th>
                    <th className="py-3 px-3 font-bold whitespace-nowrap">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {paginatedLogs.map((record) => {
                    const isIn = record.punch_type === "in";
                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-3 font-semibold text-slate-200 whitespace-nowrap">
                          <div className="whitespace-nowrap font-bold">
                            {record.profiles?.full_name || "Unknown Member"}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                            {record.profiles?.member_code}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                          {formatDate(record.punch_time)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-200 font-bold whitespace-nowrap">
                          {formatTime(record.punch_time)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap inline-flex items-center gap-1 ${
                              isIn
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {record.punch_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                            {record.method === "mobile_biometric" ? (
                              <>
                                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Mobile Biometric</span>
                              </>
                            ) : (
                              <>
                                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
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
      )}

      {/* PAGINATION CONTROLS BAR */}
      {totalItems > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Per Page Selector */}
          <div className="flex items-center gap-2 text-slate-400">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>per page</span>
          </div>

          {/* Page Indicator & Navigation */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">
              Page <strong className="text-white">{safePage}</strong> of{" "}
              <strong className="text-white">{totalPages}</strong>
              <span className="ml-1 text-slate-500">
                ({totalItems} {totalItems === 1 ? "record" : "records"})
              </span>
            </span>

            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
