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
      <div className="p-7 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-sm shadow-xs font-medium">
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
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-bold whitespace-nowrap">
            <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Mobile Biometric</span>
          </span>
        );
      case "biometric_machine":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-cyan-800 font-bold whitespace-nowrap">
            <Cpu className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
            <span>Physical Scanner</span>
          </span>
        );
      case "qr":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-800 font-bold whitespace-nowrap">
            <QrCode className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>QR Code</span>
          </span>
        );
      case "admin":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-purple-800 font-bold whitespace-nowrap">
            <Shield className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Admin Punch</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-semibold whitespace-nowrap">
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
      <div className="space-y-3">
        {sortedRecords.map((record) => {
          const isIn = record.punch_type === "in";
          return (
            <div
              key={record.id}
              className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all shadow-xs ${
                isIn
                  ? "bg-emerald-50 border-emerald-300"
                  : "bg-amber-50 border-amber-300"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isIn
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-amber-500 text-slate-950 shadow-xs"
                  }`}
                >
                  {isIn ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                </div>
                <div>
                  <div className={`text-sm font-black uppercase tracking-wider ${
                    isIn ? "text-emerald-950" : "text-amber-950"
                  }`}>
                    {isIn ? "PUNCH IN" : "PUNCH OUT"}
                  </div>
                  <div className="mt-0.5">{getMethodBadge(record.method)}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-base font-mono font-black text-black">
                  {formatTime(record.punch_time)}
                </div>
                <div className="text-xs text-emerald-800 font-black flex items-center justify-end gap-1 mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
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
      {/* Day Grouped Items */}
      <div className="space-y-6">
        {paginatedDateKeys.map((dateLabel) => {
          const dayRecords = groupedByDate[dateLabel];
          return (
            <div key={dateLabel} className="space-y-2.5">
              <div className="text-xs font-black uppercase tracking-wider text-black px-1">
                {dateLabel}
              </div>
              <div className="space-y-2.5">
                {dayRecords.map((record) => {
                  const isIn = record.punch_type === "in";
                  return (
                    <div
                      key={record.id}
                      className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 shadow-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isIn
                              ? "bg-emerald-600 text-white font-bold"
                              : "bg-amber-500 text-slate-950 font-bold"
                          }`}
                        >
                          {isIn ? (
                            <LogIn className="w-4 h-4" />
                          ) : (
                            <LogOut className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <span
                            className={`text-sm font-black mr-2.5 ${
                              isIn ? "text-emerald-950" : "text-amber-950"
                            }`}
                          >
                            {isIn ? "IN" : "OUT"}
                          </span>
                          {getMethodBadge(record.method)}
                        </div>
                      </div>

                      <div className="text-right font-mono text-base font-black text-black">
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
      <div className="bg-slate-100 border-2 border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm shadow-xs">
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
            <option value={5}>5 days</option>
            <option value={10}>10 days</option>
            <option value={20}>20 days</option>
          </select>
          <span>per page</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-800 font-mono text-sm font-semibold">
            Page <strong className="text-black text-sm font-black">{safePage}</strong> of{" "}
            <strong className="text-black text-sm font-black">{totalPages}</strong>
            <span className="ml-1 text-slate-600 font-bold">
              ({totalDays} {totalDays === 1 ? "day" : "days"})
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
  );
}
