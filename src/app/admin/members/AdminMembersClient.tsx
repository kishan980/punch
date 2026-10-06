"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  XCircle,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Smartphone,
} from "lucide-react";
import type { Profile } from "@/types/attendance";

interface AdminMembersClientProps {
  members: Profile[];
  registeredUserIds: string[];
  userPunchMap: Record<
    string,
    {
      firstInTime: string | null;
      lastOutTime: string | null;
      latestType: string | null;
    }
  >;
}

export default function AdminMembersClient({
  members,
  registeredUserIds: rawRegisteredIds,
  userPunchMap,
}: AdminMembersClientProps) {
  const registeredUserIds = useMemo(
    () => new Set(rawRegisteredIds),
    [rawRegisteredIds]
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [biometricFilter, setBiometricFilter] = useState<string>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const formatTime = (isoString?: string | null) => {
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

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Search
      const query = search.toLowerCase();
      const matchesSearch =
        !search ||
        member.full_name?.toLowerCase().includes(query) ||
        member.member_code?.toLowerCase().includes(query) ||
        member.phone?.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter !== "all" && member.status !== statusFilter) {
        return false;
      }

      // Biometric filter
      const isReg = registeredUserIds.has(member.auth_user_id);
      if (biometricFilter === "registered" && !isReg) return false;
      if (biometricFilter === "not_registered" && isReg) return false;

      return true;
    });
  }, [members, search, statusFilter, biometricFilter, registeredUserIds]);

  // Pagination calculations
  const totalItems = filteredMembers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedMembers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, safePage, pageSize]);

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <span className="text-xs text-slate-400 font-mono">
          {members.length} Total Members
        </span>
      </div>

      <div>
        <h1 className="text-xl font-black text-white uppercase tracking-tight">
          Member Management &amp; Today&apos;s Punches
        </h1>
        <p className="text-xs text-slate-400">
          User-wise biometric passkey status and live IN / OUT timestamps.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Member Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by name, ID or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handleFilterChange();
              }}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Membership Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                handleFilterChange();
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Membership Status</option>
              <option value="active">Active Members</option>
              <option value="inactive">Inactive Members</option>
            </select>
          </div>

          {/* Biometric Status Filter */}
          <div>
            <select
              value={biometricFilter}
              onChange={(e) => {
                setBiometricFilter(e.target.value);
                handleFilterChange();
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Biometric Status</option>
              <option value="registered">Registered Biometric ✅</option>
              <option value="not_registered">Not Registered ❌</option>
            </select>
          </div>
        </div>

        {/* Filter Stats */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <span>
            Showing <strong className="text-white">{filteredMembers.length}</strong> of{" "}
            <strong className="text-white">{members.length}</strong> members
          </span>
          {(search || statusFilter !== "all" || biometricFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setBiometricFilter("all");
                setCurrentPage(1);
              }}
              className="text-xs text-emerald-400 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Member List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3 font-bold whitespace-nowrap">Member ID</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Name</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Phone</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Status</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Biometric</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Today&apos;s Punch IN / OUT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-xs text-slate-500">
                    No members match your search criteria.
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member) => {
                  const isRegistered = registeredUserIds.has(member.auth_user_id);
                  const punchData = userPunchMap[member.auth_user_id];
                  const isInside = punchData?.latestType === "in";

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {member.member_code}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-200 whitespace-nowrap">
                        {member.full_name}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {member.phone || "—"}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                            member.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isRegistered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Registered ✅</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Not Registered</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {punchData?.firstInTime ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 font-mono whitespace-nowrap">
                              <LogIn className="w-2.5 h-2.5 shrink-0" />
                              <span>IN: {formatTime(punchData.firstInTime)}</span>
                            </span>

                            {punchData.lastOutTime ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 font-mono whitespace-nowrap">
                                <LogOut className="w-2.5 h-2.5 shrink-0" />
                                <span>OUT: {formatTime(punchData.lastOutTime)}</span>
                              </span>
                            ) : isInside ? (
                              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
                                INSIDE GYM
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] whitespace-nowrap">
                            No punches today
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION CONTROLS BAR */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Per Page Selector */}
          <div className="flex items-center gap-2 text-slate-400">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
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
                ({totalItems} {totalItems === 1 ? "member" : "members"})
              </span>
            </span>

            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
