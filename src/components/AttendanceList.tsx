"use client";

import type { AttendanceRecord } from "@/types/attendance";
import { LogIn, LogOut, Smartphone, Cpu, QrCode, Shield, CheckCircle } from "lucide-react";

interface AttendanceListProps {
  records: AttendanceRecord[];
  todayOnly?: boolean;
}

export default function AttendanceList({ records, todayOnly = false }: AttendanceListProps) {
  if (!records || records.length === 0) {
    return (
      <div className="p-6 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-400 text-xs">
        No attendance recorded yet today.
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
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
            <Smartphone className="w-3 h-3" />
            <span>Mobile Biometric</span>
          </span>
        );
      case "biometric_machine":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
            <Cpu className="w-3 h-3" />
            <span>Physical Scanner</span>
          </span>
        );
      case "qr":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium">
            <QrCode className="w-3 h-3" />
            <span>QR Code</span>
          </span>
        );
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-purple-400 font-medium">
            <Shield className="w-3 h-3" />
            <span>Admin Punch</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
            <span>{method}</span>
          </span>
        );
    }
  };

  if (todayOnly) {
    return (
      <div className="space-y-2.5">
        {records.map((record) => {
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

  // Group by date for history view
  const groupedByDate: Record<string, AttendanceRecord[]> = {};
  records.forEach((record) => {
    const dateKey = formatDateHeader(record.punch_time);
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(record);
  });

  return (
    <div className="space-y-6">
      {Object.entries(groupedByDate).map(([dateLabel, dayRecords]) => (
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
                      {isIn ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
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
      ))}
    </div>
  );
}
