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
        <h1 className="text-2xl sm:text-3xl font-black text-black uppercase tracking-tight">
          Admin Attendance Explorer
        </h1>
        <p className="text-sm text-slate-700 font-semibold">
          User-wise punch analysis, live in/out tracking, and filterable punch logs.
        </p>
      </div>

      {/* View Mode Toggle: User-Wise vs All Logs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 border-2 border-slate-200 rounded-2xl w-fit shadow-xs">
        <button
          onClick={() => {
            setViewMode("user-wise");
            setCurrentPage(1);
          }}
          className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
            viewMode === "user-wise"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-800 hover:text-black hover:bg-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User-Wise Punch Summary</span>
        </button>

        <button
          onClick={() => {
            setViewMode("logs");
            setCurrentPage(1);
          }}
          className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
            viewMode === "logs"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-800 hover:text-black hover:bg-slate-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>All Raw Logs Stream</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Member Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search member name/code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handleFilterChange();
              }}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-sm text-black placeholder-slate-500 font-medium focus:outline-none focus:border-emerald-600 transition-all"
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
              className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-sm text-black font-semibold focus:outline-none focus:border-emerald-600 transition-all"
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
              className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-sm text-black font-semibold focus:outline-none focus:border-emerald-600 transition-all"
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
              className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-sm text-black font-semibold focus:outline-none focus:border-emerald-600 transition-all"
            >
              <option value="all">All Punch Types (IN &amp; OUT)</option>
              <option value="in">IN Only</option>
              <option value="out">OUT Only</option>
            </select>
          </div>
        </div>

        {/* Active Filter Pills Bar */}
        {(search || selectedMember !== "all" || selectedDate || selectedPunchType !== "all") && (
          <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200">
            <span className="text-slate-800 font-semibold">Active filters applied</span>
            <button
              onClick={() => {
                setSearch("");
                setSelectedMember("all");
                setSelectedDate("");
                setSelectedPunchType("all");
                setSelectedMethod("all");
                setCurrentPage(1);
              }}
              className="text-emerald-800 hover:underline font-black"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* MAIN DATA VIEW */}
      {viewMode === "user-wise" ? (
        /* USER-WISE VIEW */
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100">
            <h2 className="text-base font-black uppercase tracking-wider text-black flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700" />
              <span>User-Wise Punch In &amp; Out Status</span>
            </h2>
            <span className="text-xs text-slate-700 font-bold">
              Showing <strong className="text-black">{paginatedUserWise.length}</strong> of <strong className="text-black">{userWiseData.length}</strong> members
            </span>
          </div>

          {paginatedUserWise.length === 0 ? (
            <p className="text-center py-12 text-sm text-slate-600 font-semibold">
              No member attendance found for the selected filters.
            </p>
          ) : (
            <div className="space-y-3">
              {paginatedUserWise.map((user) => {
                const isExpanded = expandedUser === user.memberId;
                return (
                  <div
                    key={user.memberId}
                    className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 hover:border-slate-300 transition-all space-y-3"
                  >
                    {/* User Summary Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 overflow-x-auto scrollbar-thin pb-1">
                      <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black shrink-0 border border-emerald-300">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="whitespace-nowrap">
                          <div className="font-black text-base text-black whitespace-nowrap">
                            {user.fullName}
                          </div>
                          <div className="text-xs font-mono text-emerald-800 font-black whitespace-nowrap">
                            {user.memberCode} {user.phone ? `• ${user.phone}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* Status Badges in single line */}
                      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                        {/* IN Time */}
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-center min-w-[105px] shrink-0 whitespace-nowrap shadow-2xs">
                          <span className="text-xs text-emerald-900 block uppercase font-black flex items-center justify-center gap-1 whitespace-nowrap">
                            <LogIn className="w-3.5 h-3.5 text-emerald-700" />
                            <span>PUNCH IN</span>
                          </span>
                          <span className="text-sm font-mono font-black text-emerald-950 whitespace-nowrap">
                            {formatTime(user.firstInTime)}
                          </span>
                        </div>

                        {/* OUT Time */}
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-center min-w-[105px] shrink-0 whitespace-nowrap shadow-2xs">
                          <span className="text-xs text-amber-900 block uppercase font-black flex items-center justify-center gap-1 whitespace-nowrap">
                            <LogOut className="w-3.5 h-3.5 text-amber-700" />
                            <span>PUNCH OUT</span>
                          </span>
                          <span className="text-sm font-mono font-black text-amber-950 whitespace-nowrap">
                            {formatTime(user.lastOutTime)}
                          </span>
                        </div>

                        {/* Status Inside/Outside */}
                        <div className="min-w-[105px] text-center shrink-0 whitespace-nowrap">
                          {user.isInside ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-black border border-emerald-800 animate-pulse whitespace-nowrap">
                              <Activity className="w-3.5 h-3.5 text-white shrink-0" />
                              <span>INSIDE GYM</span>
                            </span>
                          ) : user.lastOutTime ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-black border border-slate-900 whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                              <span>COMPLETED</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold whitespace-nowrap">
                              No punches
                            </span>
                          )}
                        </div>

                        {/* Expand Button */}
                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : user.memberId)}
                          className="p-2 rounded-xl bg-white border-2 border-slate-300 text-slate-800 hover:text-black transition-colors shrink-0 font-bold"
                          title="View all punches for this user"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Punch Log Drawer */}
                    {isExpanded && (
                      <div className="pt-3 border-t-2 border-slate-200 space-y-2 animate-fadeIn">
                        <div className="text-xs font-black text-black uppercase tracking-wider">
                          Full punch logs today ({user.punches.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {user.punches.map((p) => (
                            <div
                              key={p.id}
                              className={`p-3 rounded-xl border flex items-center justify-between text-sm ${
                                p.punch_type === "in"
                                  ? "bg-emerald-600 text-white"
                                  : "bg-amber-500 text-slate-950 font-black"
                              }`}
                            >
                              <div className="flex items-center gap-2 font-black whitespace-nowrap">
                                {p.punch_type === "in" ? (
                                  <LogIn className="w-4 h-4 text-white" />
                                ) : (
                                  <LogOut className="w-4 h-4 text-slate-950" />
                                )}
                                <span>{p.punch_type.toUpperCase()}</span>
                                <span className={`text-xs font-bold ${p.punch_type === "in" ? "text-emerald-100" : "text-amber-950"}`}>
                                  ({formatDate(p.punch_time)})
                                </span>
                              </div>
                              <span className="font-mono font-black whitespace-nowrap">
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
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100">
            <h2 className="text-base font-black uppercase tracking-wider text-black flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-700" />
              <span>All Punches (Latest Insert First)</span>
            </h2>
            <span className="text-xs text-slate-700 font-bold">
              Showing <strong className="text-black">{paginatedLogs.length}</strong> of <strong className="text-black">{filteredRecords.length}</strong> records
            </span>
          </div>

          {paginatedLogs.length === 0 ? (
            <p className="text-center py-12 text-sm text-slate-600 font-semibold">
              No punch records match your filter criteria.
            </p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100/90 border-b-2 border-slate-300 text-black uppercase tracking-wider text-xs">
                    <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Member</th>
                    <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Date</th>
                    <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Time</th>
                    <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Punch Type</th>
                    <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedLogs.map((record) => {
                    const isIn = record.punch_type === "in";
                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3.5 px-3.5 font-bold text-black whitespace-nowrap">
                          <div className="whitespace-nowrap font-black text-sm text-black">
                            {record.profiles?.full_name || "Unknown Member"}
                          </div>
                          <div className="text-xs font-mono text-emerald-800 font-bold whitespace-nowrap">
                            {record.profiles?.member_code}
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 text-black whitespace-nowrap font-bold">
                          {formatDate(record.punch_time)}
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-black font-black whitespace-nowrap text-sm">
                          {formatTime(record.punch_time)}
                        </td>
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap inline-flex items-center gap-1 ${
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
                                <Smartphone className="w-4 h-4 text-emerald-700" />
                                <span className="text-emerald-950 font-black">Mobile Biometric</span>
                              </>
                            ) : (
                              <>
                                <Cpu className="w-4 h-4 text-cyan-700" />
                                <span className="text-cyan-950 font-black">{record.method}</span>
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
        <div className="bg-slate-100 border-2 border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm shadow-xs">
          {/* Per Page Selector */}
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
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>per page</span>
          </div>

          {/* Page Indicator & Navigation */}
          <div className="flex items-center gap-2">
            <span className="text-slate-800 font-mono text-sm font-semibold">
              Page <strong className="text-black text-sm font-black">{safePage}</strong> of{" "}
              <strong className="text-black text-sm font-black">{totalPages}</strong>
              <span className="ml-1 text-slate-600 font-bold">
                ({totalItems} {totalItems === 1 ? "record" : "records"})
              </span>
            </span>

            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-2 rounded-xl bg-white border-2 border-slate-300 text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-2 rounded-xl bg-white border-2 border-slate-300 text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
