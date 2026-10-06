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
  QrCode,
  Shield,
  Download,
} from "lucide-react";
import type { AttendanceRecord } from "@/types/attendance";

interface AdminAttendanceExplorerProps {
  initialRecords: AttendanceRecord[];
}

export default function AdminAttendanceExplorer({
  initialRecords,
}: AdminAttendanceExplorerProps) {
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPunchType, setSelectedPunchType] = useState<string>("all");
  const [selectedMethod, setSelectedMethod] = useState<string>("all");

  const filteredRecords = useMemo(() => {
    return initialRecords.filter((record) => {
      // Search filter
      const memberName = record.profiles?.full_name?.toLowerCase() || "";
      const memberCode = record.profiles?.member_code?.toLowerCase() || "";
      const query = search.toLowerCase();
      if (search && !memberName.includes(query) && !memberCode.includes(query)) {
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
    });
  }, [initialRecords, search, selectedDate, selectedPunchType, selectedMethod]);

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
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <span className="text-xs text-slate-400 font-mono">
          Showing {filteredRecords.length} of {initialRecords.length} records
        </span>
      </div>

      <div>
        <h1 className="text-xl font-black text-white uppercase tracking-tight">
          Attendance Log Explorer
        </h1>
        <p className="text-xs text-slate-400">
          Filter and analyze gym punches across members, dates, and biometric methods.
        </p>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Member Search */}
          <div className="sm:col-span-1 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Date Picker */}
          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Punch Type Filter */}
          <div>
            <select
              value={selectedPunchType}
              onChange={(e) => setSelectedPunchType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Punch Types</option>
              <option value="in">IN Only</option>
              <option value="out">OUT Only</option>
            </select>
          </div>

          {/* Method Filter */}
          <div>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Methods</option>
              <option value="mobile_biometric">Mobile Biometric</option>
              <option value="biometric_machine">Physical Scanner</option>
              <option value="qr">QR Code</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {(search || selectedDate || selectedPunchType !== "all" || selectedMethod !== "all") && (
          <div className="pt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">Filters applied</span>
            <button
              onClick={() => {
                setSearch("");
                setSelectedDate("");
                setSelectedPunchType("all");
                setSelectedMethod("all");
              }}
              className="text-emerald-400 hover:underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Attendance Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        {filteredRecords.length === 0 ? (
          <p className="text-center py-12 text-xs text-slate-500">
            No attendance records match your filter criteria.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="pb-3 font-bold">Member</th>
                  <th className="pb-3 font-bold">Date</th>
                  <th className="pb-3 font-bold">Time</th>
                  <th className="pb-3 font-bold">Punch Type</th>
                  <th className="pb-3 font-bold">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredRecords.map((record) => {
                  const isIn = record.punch_type === "in";
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 font-semibold text-slate-200">
                        <div>{record.profiles?.full_name || "Unknown Member"}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {record.profiles?.member_code}
                        </div>
                      </td>
                      <td className="py-3.5 text-slate-300">
                        {formatDate(record.punch_time)}
                      </td>
                      <td className="py-3.5 font-mono text-slate-300">
                        {formatTime(record.punch_time)}
                      </td>
                      <td className="py-3.5">
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
                      <td className="py-3.5 text-slate-400">
                        <span className="inline-flex items-center gap-1.5 text-[11px]">
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
    </div>
  );
}
