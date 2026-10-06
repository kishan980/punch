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
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <span className="text-xs text-slate-500 font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200">
          {members.length} Total Members
        </span>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-black uppercase tracking-tight">
          Member Management &amp; Today&apos;s Punches
        </h1>
        <p className="text-sm text-slate-700 font-semibold">
          User-wise biometric passkey status and live IN / OUT timestamps.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Member Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by name, ID or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handleFilterChange();
              }}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-sm text-black placeholder-slate-500 font-medium focus:outline-none focus:border-emerald-600 transition-all"
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
              className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-sm text-black font-semibold focus:outline-none focus:border-emerald-600 transition-all"
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
              className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-slate-300 text-sm text-black font-semibold focus:outline-none focus:border-emerald-600 transition-all"
            >
              <option value="all">All Biometric Status</option>
              <option value="registered">Registered Biometric ✅</option>
              <option value="not_registered">Not Registered ❌</option>
            </select>
          </div>
        </div>

        {/* Filter Stats */}
        <div className="flex items-center justify-between text-xs text-slate-700 font-semibold pt-2 border-t border-slate-200">
          <span>
            Showing <strong className="text-black">{filteredMembers.length}</strong> of{" "}
            <strong className="text-black">{members.length}</strong> members
          </span>
          {(search || statusFilter !== "all" || biometricFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setBiometricFilter("all");
                setCurrentPage(1);
              }}
              className="text-xs text-emerald-800 hover:underline font-black"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Member List Table */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100/90 border-b-2 border-slate-300 text-black uppercase tracking-wider text-xs">
                <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Member ID</th>
                <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Name</th>
                <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Phone</th>
                <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Status</th>
                <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Biometric</th>
                <th className="py-3.5 px-3.5 font-black whitespace-nowrap">Today&apos;s Punch IN / OUT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm text-slate-600 font-bold">
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
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3.5 px-3.5 font-mono font-black text-emerald-800 whitespace-nowrap text-sm">
                        {member.member_code}
                      </td>
                      <td className="py-3.5 px-3.5 font-black text-black whitespace-nowrap text-sm">
                        {member.full_name}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono font-bold text-slate-800 whitespace-nowrap text-sm">
                        {member.phone || "—"}
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap ${
                            member.status === "active"
                              ? "bg-emerald-600 text-white"
                              : "bg-rose-600 text-white"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        {isRegistered ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-950 font-black bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300 whitespace-nowrap">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span>Registered ✅</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300 whitespace-nowrap">
                            <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>Not Registered</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        {punchData?.firstInTime ? (
                          <div className="flex items-center gap-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-xs font-black text-white bg-emerald-600 px-2.5 py-1 rounded-lg font-mono whitespace-nowrap shadow-2xs">
                              <LogIn className="w-3.5 h-3.5 text-white shrink-0" />
                              <span>IN: {formatTime(punchData.firstInTime)}</span>
                            </span>

                            {punchData.lastOutTime ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-950 bg-amber-500 px-2.5 py-1 rounded-lg font-mono whitespace-nowrap shadow-2xs">
                                <LogOut className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                                <span>OUT: {formatTime(punchData.lastOutTime)}</span>
                              </span>
                            ) : isInside ? (
                              <span className="text-xs font-black text-white bg-emerald-700 px-3 py-1 rounded-full border border-emerald-800 whitespace-nowrap animate-pulse">
                                INSIDE GYM
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs font-bold whitespace-nowrap">
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
        <div className="bg-slate-100 border-2 border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
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
                ({totalItems} {totalItems === 1 ? "member" : "members"})
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
      </div>
    </div>
  );
}
