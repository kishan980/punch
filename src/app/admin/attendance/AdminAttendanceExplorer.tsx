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
      const uId = record.member_id;
      if (!userMap.has(uId)) {
        userMap.set(uId, {
          memberId: uId,
          fullName: record.profiles?.full_name || "Unknown Member",
          memberCode: record.profiles?.member_code || "—",
          phone: record.profiles?.phone,
          punches: [],
        });
      }
      userMap.get(uId)!.punches.push(record);
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
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            {totalItems} {viewMode === "user-wise" ? "Members" : "Punches"}
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
          Admin Attendance Explorer
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          User-wise punch analysis, live in/out tracking, and filterable punch logs.
        </p>
      </div>

      {/* View Mode Toggle: User-Wise vs All Logs */}
      <div className="flex items-center gap-2 p-1 bg-white border border-slate-200/80 rounded-2xl w-fit shadow-xs">
        <button
          onClick={() => {
            setViewMode("user-wise");
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            viewMode === "user-wise"
              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
              : "text-slate-500 hover:text-slate-900"
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
              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>All Raw Logs Stream</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Member Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search member name/code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handleFilterChange();
              }}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition-all"
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
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-emerald-600 transition-all"
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
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-emerald-600 transition-all"
            />
          </div>

          {/* Punch Type */}
          <div>
            <select
              value={selectedPunchType}
              onChange={(e) => {
                setSelectedPunchType(e.target.value);
                handleFilterChange();
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-emerald-600 transition-all"
            >
              <option value="all">All Punch Types (IN &amp; OUT)</option>
              <option value="in">IN Only</option>
              <option value="out">OUT Only</option>
            </select>
          </div>
        </div>

        {/* Active Filter Pills Bar */}
        {(search || selectedMember !== "all" || selectedDate || selectedPunchType !== "all") && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="text-slate-500">Active filters applied</span>
            <button
              onClick={() => {
                setSearch("");
                setSelectedMember("all");
                setSelectedDate("");
                setSelectedPunchType("all");
                setSelectedMethod("all");
                setCurrentPage(1);
              }}
              className="text-emerald-600 hover:underline font-bold"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* MAIN DATA VIEW */}
      {viewMode === "user-wise" ? (
        /* USER-WISE VIEW */
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>User-Wise Punch In &amp; Out Status</span>
            </h2>
            <span className="text-[11px] text-slate-500">
              Showing {paginatedUserWise.length} of {userWiseData.length} members
            </span>
          </div>

          {paginatedUserWise.length === 0 ? (
            <p className="text-center py-12 text-xs text-slate-400">
              No member attendance found for the selected filters.
            </p>
          ) : (
            <div className="space-y-3">
              {paginatedUserWise.map((user) => {
                const isExpanded = expandedUser === user.memberId;
                return (
                  <div
                    key={user.memberId}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-all space-y-3"
                  >
                    {/* User Summary Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 overflow-x-auto scrollbar-thin pb-1">
                      <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="whitespace-nowrap">
                          <div className="font-bold text-sm text-slate-900 whitespace-nowrap">
                            {user.fullName}
                          </div>
                          <div className="text-[11px] font-mono text-emerald-700 font-bold whitespace-nowrap">
                            {user.memberCode} {user.phone ? `• ${user.phone}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* Status Badges in single line */}
                      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                        {/* IN Time */}
                        <div className="p-2 rounded-xl bg-white border border-slate-200 text-center min-w-[95px] shrink-0 whitespace-nowrap shadow-2xs">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold flex items-center justify-center gap-1 whitespace-nowrap">
                            <LogIn className="w-2.5 h-2.5 text-emerald-600" />
                            <span>PUNCH IN</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {formatTime(user.firstInTime)}
                          </span>
                        </div>

                        {/* OUT Time */}
                        <div className="p-2 rounded-xl bg-white border border-slate-200 text-center min-w-[95px] shrink-0 whitespace-nowrap shadow-2xs">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold flex items-center justify-center gap-1 whitespace-nowrap">
                            <LogOut className="w-2.5 h-2.5 text-amber-600" />
                            <span>PUNCH OUT</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-700 whitespace-nowrap">
                            {formatTime(user.lastOutTime)}
                          </span>
                        </div>

                        {/* Status Inside/Outside */}
                        <div className="min-w-[95px] text-center shrink-0 whitespace-nowrap">
                          {user.isInside ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300 animate-pulse whitespace-nowrap">
                              <Activity className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>INSIDE GYM</span>
                            </span>
                          ) : user.lastOutTime ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-300 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>COMPLETED</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-500 text-[11px] font-medium whitespace-nowrap">
                              No punches
                            </span>
                          )}
                        </div>

                        {/* Expand Button */}
                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : user.memberId)}
                          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shrink-0"
                          title="View all punches for this user"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Punch Log Drawer */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-200/80 space-y-2 animate-fadeIn">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Full punch logs today ({user.punches.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {user.punches.map((p) => (
                            <div
                              key={p.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                                p.punch_type === "in"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 font-bold">
                                {p.punch_type === "in" ? (
                                  <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <LogOut className="w-3.5 h-3.5 text-amber-600" />
                                )}
                                <span>{p.punch_type.toUpperCase()}</span>
                                <span className="text-[10px] text-slate-500 font-normal">
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
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>All Punches (Latest Insert First)</span>
            </h2>
            <span className="text-[11px] text-slate-500">
              Showing {paginatedLogs.length} of {filteredRecords.length} records
            </span>
          </div>

          {paginatedLogs.length === 0 ? (
            <p className="text-center py-12 text-xs text-slate-400">
              No punch records match your filter criteria.
            </p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="min-w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3 font-bold whitespace-nowrap">Member</th>
                    <th className="py-3 px-3 font-bold whitespace-nowrap">Date</th>
                    <th className="py-3 px-3 font-bold whitespace-nowrap">Time</th>
                    <th className="py-3 px-3 font-bold whitespace-nowrap">Punch Type</th>
                    <th className="py-3 px-3 font-bold whitespace-nowrap">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((record) => {
                    const isIn = record.punch_type === "in";
                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          <div className="whitespace-nowrap font-bold">
                            {record.profiles?.full_name || "Unknown Member"}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                            {record.profiles?.member_code}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {formatDate(record.punch_time)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-900 font-bold whitespace-nowrap">
                          {formatTime(record.punch_time)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap inline-flex items-center gap-1 ${
                              isIn
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {record.punch_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                            {record.method === "mobile_biometric" ? (
                              <>
                                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-800 font-medium">Mobile Biometric</span>
                              </>
                            ) : (
                              <>
                                <Cpu className="w-3.5 h-3.5 text-cyan-600" />
                                <span className="text-cyan-800 font-medium">{record.method}</span>
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
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xs">
          {/* Per Page Selector */}
          <div className="flex items-center gap-2 text-slate-500">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-600"
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
            <span className="text-slate-500 font-mono">
              Page <strong className="text-slate-900">{safePage}</strong> of{" "}
              <strong className="text-slate-900">{totalPages}</strong>
              <span className="ml-1 text-slate-400">
                ({totalItems} {totalItems === 1 ? "record" : "records"})
              </span>
            </span>

            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
