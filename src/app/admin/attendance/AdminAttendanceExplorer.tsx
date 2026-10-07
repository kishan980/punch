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

function formatTime(isoString?: string | null) {
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
}

function formatDate(isoString?: string | null) {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export default function AdminAttendanceExplorer({
  initialRecords,
}: AdminAttendanceExplorerProps) {
  const [viewMode, setViewMode] = useState<"user-wise" | "logs">("user-wise");
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPunchType, setSelectedPunchType] = useState<string>("all");
  const [selectedMethod, setSelectedMethod] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Available unique months list
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    initialRecords.forEach((r) => {
      if (r.punch_time) {
        const d = new Date(r.punch_time);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        set.add(key);
      }
    });
    return Array.from(set).sort().reverse();
  }, [initialRecords]);

  const formatMonthLabel = (monthKey: string) => {
    try {
      const [year, month] = monthKey.split("-").map(Number);
      return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return monthKey;
    }
  };

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

        // Month filter
        if (selectedMonth !== "all") {
          const recMonth = record.punch_time?.slice(0, 7);
          if (recMonth !== selectedMonth) {
            return false;
          }
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
    selectedMonth,
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

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const targetMonthKey = selectedMonth !== "all" ? selectedMonth : currentMonthKey;
    const targetMonthLabel = formatMonthLabel(targetMonthKey);

    return Array.from(userMap.values()).map((u) => {
      // Punches are sorted newest first
      const latestPunch = u.punches[0];
      const isInside = latestPunch?.punch_type === "in";

      // Punches in chronological order
      const punchesAsc = [...u.punches].reverse();

      // Build structured workout sessions pairing each IN with its matching OUT
      interface WorkoutSession {
        id: string;
        dateStr: string;
        isoDate: string;
        inTime: string;
        outTime: string | null;
        durationMins: number;
        durationDisplay: string;
        isOngoing: boolean;
      }

      const sessions: WorkoutSession[] = [];
      let currentSession: WorkoutSession | null = null;

      for (const p of punchesAsc) {
        if (p.punch_type === "in") {
          if (currentSession !== null && currentSession.outTime === null) {
            // Member punched IN again without punching OUT; close previous session
            const start = new Date(currentSession.inTime).getTime();
            const end = new Date(p.punch_time).getTime();
            currentSession.outTime = p.punch_time;
            const diffMins = Math.max(0, Math.floor((end - start) / 60000));
            currentSession.durationMins = diffMins;
            const h = Math.floor(diffMins / 60);
            const m = diffMins % 60;
            currentSession.durationDisplay = h > 0 ? `${h}h ${m}m` : `${m}m`;
            sessions.push(currentSession);
          }

          currentSession = {
            id: p.id,
            dateStr: formatDate(p.punch_time),
            isoDate: p.punch_time.slice(0, 10),
            inTime: p.punch_time,
            outTime: null,
            durationMins: 0,
            durationDisplay: "Ongoing",
            isOngoing: true,
          };
        } else if (p.punch_type === "out") {
          if (currentSession !== null) {
            const start = new Date(currentSession.inTime).getTime();
            const end = new Date(p.punch_time).getTime();
            currentSession.outTime = p.punch_time;
            currentSession.isOngoing = false;
            const diffMins = Math.max(0, Math.floor((end - start) / 60000));
            currentSession.durationMins = diffMins;
            const h = Math.floor(diffMins / 60);
            const m = diffMins % 60;
            currentSession.durationDisplay = h > 0 ? `${h}h ${m}m` : `${m}m`;
            sessions.push(currentSession);
            currentSession = null;
          } else {
            // Unpaired out
            sessions.push({
              id: p.id,
              dateStr: formatDate(p.punch_time),
              isoDate: p.punch_time.slice(0, 10),
              inTime: p.punch_time,
              outTime: p.punch_time,
              durationMins: 0,
              durationDisplay: "Out Only",
              isOngoing: false,
            });
          }
        }
      }

      if (currentSession !== null) {
        if (isInside) {
          const start = new Date(currentSession.inTime).getTime();
          const diffMins = Math.max(0, Math.floor((Date.now() - start) / 60000));
          currentSession.durationMins = diffMins;
          const h = Math.floor(diffMins / 60);
          const m = diffMins % 60;
          currentSession.durationDisplay = h > 0 ? `${h}h ${m}m (Live)` : `${m}m (Live)`;
          currentSession.isOngoing = true;
        }
        sessions.push(currentSession);
      }

      // Compute MONTHLY workout hours (Target / Selected Month)
      const monthSessions = sessions.filter((s) => s.isoDate.startsWith(targetMonthKey));
      const monthTotalMins = monthSessions.reduce((acc, s) => acc + s.durationMins, 0);
      const monthHrs = Math.floor(monthTotalMins / 60);
      const monthMins = monthTotalMins % 60;
      const monthDecimalHrs = (monthTotalMins / 60).toFixed(1);
      const monthDaysCount = new Set(monthSessions.map((s) => s.isoDate)).size;

      let monthHoursDisplay = "0 hrs";
      if (monthTotalMins > 0) {
        if (monthHrs > 0) {
          monthHoursDisplay = `${monthHrs} hr ${monthMins} min (${monthDecimalHrs} hrs)`;
        } else {
          monthHoursDisplay = `${monthMins} min (${monthDecimalHrs} hrs)`;
        }
      } else if (monthSessions.length > 0) {
        monthHoursDisplay = "< 1 min";
      }

      // Compute TODAY'S workout hours
      const todaySessions = sessions.filter((s) => s.isoDate === todayStr);
      const todayTotalMins = todaySessions.reduce((acc, s) => acc + s.durationMins, 0);
      const todayHrs = Math.floor(todayTotalMins / 60);
      const todayMins = todayTotalMins % 60;
      const todayDecimalHrs = (todayTotalMins / 60).toFixed(1);

      let todayHoursDisplay = "0 hrs";
      if (todayTotalMins > 0) {
        if (todayHrs > 0) {
          todayHoursDisplay = `${todayHrs} hr ${todayMins} min (${todayDecimalHrs} hrs)`;
        } else {
          todayHoursDisplay = `${todayMins} min (${todayDecimalHrs} hrs)`;
        }
      } else if (todaySessions.length > 0) {
        todayHoursDisplay = "< 1 min";
      }

      const todayFirstIn = todaySessions.find((s) => s.inTime)?.inTime || null;
      const todayLastOut = [...todaySessions].reverse().find((s) => s.outTime)?.outTime || null;

      return {
        ...u,
        isInside,
        sessions,
        targetMonthLabel,
        monthHoursDisplay,
        monthDaysCount,
        monthSessionsCount: monthSessions.length,
        todayHoursDisplay,
        todayFirstIn,
        todayLastOut,
        hasActivityToday: todaySessions.length > 0,
      };
    });
  }, [filteredRecords, selectedMonth]);

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

      {/* View Mode Toggle: User-Wise vs All Logs (Stacked on mobile, side-by-side on desktop) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 bg-slate-100 border-2 border-slate-200 rounded-2xl w-full sm:w-fit shadow-xs">
        <button
          onClick={() => {
            setViewMode("user-wise");
            setCurrentPage(1);
          }}
          className={`w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center sm:justify-start gap-2.5 ${
            viewMode === "user-wise"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-800 hover:text-black hover:bg-slate-200"
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>User-Wise Punch Summary</span>
        </button>

        <button
          onClick={() => {
            setViewMode("logs");
            setCurrentPage(1);
          }}
          className={`w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center sm:justify-start gap-2.5 ${
            viewMode === "logs"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-800 hover:text-black hover:bg-slate-200"
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>All Raw Logs Stream</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Member Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search member..."
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

          {/* Month Selector Filter */}
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                handleFilterChange();
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-sm text-black font-semibold focus:outline-none focus:border-emerald-600 transition-all"
            >
              <option value="all">All Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
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
        {(search || selectedMember !== "all" || selectedMonth !== "all" || selectedDate || selectedPunchType !== "all") && (
          <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200">
            <span className="text-slate-800 font-semibold">Active filters applied</span>
            <button
              onClick={() => {
                setSearch("");
                setSelectedMember("all");
                setSelectedMonth("all");
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
                    {/* User Summary Row: Clean Line-by-Line Layout */}
                    <div className="space-y-2.5">
                      {/* Line 1: Member Info (Full width, no truncation) + Expand Button */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black shrink-0 border border-emerald-300">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-base text-black break-words leading-tight">
                              {user.fullName}
                            </div>
                            <div className="text-xs font-mono text-emerald-800 font-black mt-0.5">
                              {user.memberCode} {user.phone ? `• ${user.phone}` : ""}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : user.memberId)}
                          className="p-1.5 sm:p-2 rounded-xl bg-white border-2 border-slate-300 text-slate-800 hover:text-black transition-colors shrink-0 font-bold"
                          title="View all punches"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Line 2: Status Badge */}
                      <div className="flex items-center justify-between gap-2 py-0.5">
                        {user.isInside ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-black border border-emerald-800 animate-pulse whitespace-nowrap">
                            <Activity className="w-3.5 h-3.5 text-white shrink-0" />
                            <span>INSIDE GYM</span>
                          </span>
                        ) : user.todayLastOut ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-black border border-slate-900 whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                            <span>COMPLETED TODAY</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold whitespace-nowrap">
                            No activity today
                          </span>
                        )}

                        <span className="text-xs font-mono font-bold text-slate-700">
                          {user.isInside ? (
                            <span className="text-emerald-800 font-black">Workout In Progress</span>
                          ) : user.todayLastOut ? (
                            <span className="text-slate-700 font-bold">Session Ended</span>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>

                      {/* Line 3: THIS MONTH'S TOTAL GYM TIME (Pure Month Ka Time) */}
                      <div className="p-3 rounded-2xl bg-indigo-50 border-2 border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 shadow-2xs">
                        <div className="flex items-center gap-2 font-black text-xs text-indigo-950 uppercase tracking-wide">
                          <Calendar className="w-4 h-4 text-indigo-700 shrink-0" />
                          <span>MONTH&apos;S TOTAL GYM TIME ({user.targetMonthLabel})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-base sm:text-lg font-mono font-black text-indigo-950">
                            {user.monthHoursDisplay}
                          </span>
                          <span className="text-xs font-bold text-indigo-900 bg-indigo-100 px-2.5 py-0.5 rounded-lg border border-indigo-300 whitespace-nowrap">
                            {user.monthDaysCount} Days Active
                          </span>
                        </div>
                      </div>

                      {/* Line 4: TODAY'S WORKOUT TIME */}
                      <div className="p-2.5 sm:p-3 rounded-xl bg-blue-50 border-2 border-blue-200 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2 font-black text-xs text-blue-950 uppercase tracking-wide">
                          <Clock className="w-4 h-4 text-blue-700 shrink-0" />
                          <span>TODAY&apos;S WORKOUT TIME</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm sm:text-base font-mono font-black text-blue-950">
                            {user.todayHoursDisplay}
                          </span>
                          {user.isInside && (
                            <span className="text-[10px] uppercase font-black text-emerald-700 block animate-pulse">
                              ● Live Ongoing Inside
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Line 5: TODAY'S PUNCH IN (FIRST) */}
                      <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2 font-black text-xs text-emerald-950 uppercase tracking-wide">
                          <LogIn className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>TODAY PUNCH IN</span>
                        </div>
                        <span className="text-sm font-mono font-black text-emerald-950">
                          {formatTime(user.todayFirstIn)}
                        </span>
                      </div>

                      {/* Line 6: TODAY'S PUNCH OUT (SECOND) */}
                      <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2 font-black text-xs text-amber-950 uppercase tracking-wide">
                          <LogOut className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>TODAY PUNCH OUT</span>
                        </div>
                        <span className="text-sm font-mono font-black text-amber-950">
                          {user.todayLastOut ? formatTime(user.todayLastOut) : user.isInside ? "Still Inside Gym" : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Punch Log Drawer: IN FIRST, OUT SECOND */}
                    {isExpanded && (
                      <div className="pt-3 border-t-2 border-slate-200 space-y-2.5 animate-fadeIn">
                        <div className="flex items-center justify-between text-xs font-black text-black uppercase tracking-wider">
                          <span>Workout Sessions History (IN ➔ OUT)</span>
                          <span className="text-slate-500 font-mono">
                            {user.sessions.length} sessions ({user.punches.length} punches)
                          </span>
                        </div>

                        <div className="space-y-2">
                          {user.sessions.length === 0 ? (
                            <p className="text-xs text-slate-500 font-medium py-2">No sessions found.</p>
                          ) : (
                            user.sessions
                              .slice()
                              .reverse()
                              .map((sess, idx) => (
                                <div
                                  key={sess.id || idx}
                                  className="p-3 rounded-2xl bg-white border-2 border-slate-200 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                      {sess.dateStr}
                                    </span>
                                  </div>

                                  {/* PAIR: IN ALWAYS FIRST, OUT ALWAYS SECOND */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* IN (FIRST) */}
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-mono text-xs font-black shadow-2xs">
                                      <LogIn className="w-3.5 h-3.5 text-white shrink-0" />
                                      <span>IN: {formatTime(sess.inTime)}</span>
                                    </div>

                                    <span className="text-slate-400 font-black px-0.5 text-sm">➔</span>

                                    {/* OUT (SECOND) */}
                                    {sess.outTime ? (
                                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-mono text-xs font-black shadow-2xs">
                                        <LogOut className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                                        <span>OUT: {formatTime(sess.outTime)}</span>
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 text-white font-mono text-xs font-black border border-emerald-800 animate-pulse shadow-2xs">
                                        <Activity className="w-3.5 h-3.5 text-white shrink-0" />
                                        <span>STILL INSIDE</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* DURATION */}
                                  <div className="text-xs font-mono font-black text-indigo-950 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl self-start sm:self-auto">
                                    ⏱ {sess.durationDisplay}
                                  </div>
                                </div>
                              ))
                          )}
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
