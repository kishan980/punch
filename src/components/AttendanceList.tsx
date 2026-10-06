"use client";

import { useState, useMemo } from "react";
import type { AttendanceRecord } from "@/types/attendance";
import {
  LogIn,
  LogOut,
  Smartphone,
  Cpu,
  QrCode,
  Shield,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AttendanceListProps {
  records: AttendanceRecord[];
  todayOnly?: boolean;
  defaultPageSize?: number;
}

export default function AttendanceList({
  records,
  todayOnly = false,
  defaultPageSize = 10,
}: AttendanceListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  if (!records || records.length === 0) {
    return (
      <div className="p-6 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-400 text-xs">
        No attendance recorded yet.
      </div>
    );
  }

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const formatDateHeader = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "mobile_biometric":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium whitespace-nowrap">
            <Smartphone className="w-3 h-3 shrink-0" />
            <span>Mobile Biometric</span>
          </span>
        );
      case "biometric_machine":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-medium whitespace-nowrap">
            <Cpu className="w-3 h-3 shrink-0" />
            <span>Physical Scanner</span>
          </span>
        );
      case "qr":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium whitespace-nowrap">
            <QrCode className="w-3 h-3 shrink-0" />
            <span>QR Code</span>
          </span>
        );
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-purple-400 font-medium whitespace-nowrap">
            <Shield className="w-3 h-3 shrink-0" />
            <span>Admin Punch</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium whitespace-nowrap">
            <span>{method}</span>
          </span>
        );
    }
  };

  // Always ensure records are sorted newest first (descending)
  const sortedRecords = useMemo(() => {
    return [...records].sort(
      (a, b) => new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime()
    );
  }, [records]);

  // If todayOnly is true, show direct list without pagination unless records > 10
  if (todayOnly) {
    return (
      <div className="space-y-2.5">
        {sortedRecords.map((record) => {
          const isIn = record.punch_type === "in";
          return (
            <div
              key={record.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                isIn
                  ? "bg-emerald-950/20 border-emerald-500/20"
                  : "bg-amber-950/20 border-amber-500/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isIn
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {isIn ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    {isIn ? "PUNCH IN" : "PUNCH OUT"}
                  </div>
                  <div>{getMethodBadge(record.method)}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-mono font-bold text-white">
                  {formatTime(record.punch_time)}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Verified</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Group by date for history view (newest days and newest punches within each day first)
  const groupedByDate: Record<string, AttendanceRecord[]> = {};
  sortedRecords.forEach((record) => {
    const dateKey = formatDateHeader(record.punch_time);
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(record);
  });

  const dateKeys = Object.keys(groupedByDate);
  const totalDays = dateKeys.length;
  const totalPages = Math.max(1, Math.ceil(totalDays / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedDateKeys = dateKeys.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Day Gruped Items */}
      <div className="space-y-6">
        {paginatedDateKeys.map((dateLabel) => {
          const dayRecords = groupedByDate[dateLabel];
          return (
            <div key={dateLabel} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
                {dateLabel}
              </div>
              <div className="space-y-2">
                {dayRecords.map((record) => {
                  const isIn = record.punch_type === "in";
                  return (
                    <div
                      key={record.id}
                      className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isIn
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {isIn ? (
                            <LogIn className="w-3.5 h-3.5" />
                          ) : (
                            <LogOut className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <span
                            className={`text-xs font-bold mr-2 ${
                              isIn ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {isIn ? "IN" : "OUT"}
                          </span>
                          {getMethodBadge(record.method)}
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs font-semibold text-slate-200">
                        {formatTime(record.punch_time)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
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
            <option value={5}>5 days</option>
            <option value={10}>10 days</option>
            <option value={20}>20 days</option>
          </select>
          <span>per page</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono">
            Page <strong className="text-white">{safePage}</strong> of{" "}
            <strong className="text-white">{totalPages}</strong>
            <span className="ml-1 text-slate-500">
              ({totalDays} {totalDays === 1 ? "day" : "days"})
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
    </div>
  );
}
