"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Fingerprint,
  Activity,
  Clock,
  Smartphone,
  Cpu,
  Radio,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Navigation,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Save,
  Loader2,
} from "lucide-react";
import type { AttendanceRecord } from "@/types/attendance";
import type { GymLocationConfig } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import { soundEffects } from "@/lib/audio";

interface AdminDashboardClientProps {
  initialTotalMembers: number;
  initialTodayPunches: AttendanceRecord[];
}

export default function AdminDashboardClient({
  initialTotalMembers,
  initialTodayPunches,
}: AdminDashboardClientProps) {
  const supabase = createClient();
  const [punches, setPunches] = useState<AttendanceRecord[]>(
    [...initialTodayPunches].sort(
      (a, b) => new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime()
    )
  );
  const [totalMembers] = useState(initialTotalMembers);
  const [liveEventNotice, setLiveEventNotice] = useState<string | null>(null);

  // GPS Geofence Settings State
  const [locationConfig, setLocationConfig] = useState<GymLocationConfig>({
    latitude: 19.0760,
    longitude: 72.8777,
    radiusMeters: 10,
    isEnabled: true,
    officeName: "Main Gym / Office",
  });
  const [locSaving, setLocSaving] = useState(false);
  const [locDetecting, setLocDetecting] = useState(false);
  const [locNotice, setLocNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load initial location config from API
  useEffect(() => {
    fetch("/api/admin/location")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.latitude !== undefined) {
          setLocationConfig(data);
        }
      })
      .catch((err) => console.error("Error loading location settings:", err));
  }, []);

  // 1. Supabase Realtime Channel
  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime-attendance")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance",
        },
        async (payload) => {
          const newRecord = payload.new as AttendanceRecord;

          // Fetch member profile details to display member name
          const { data: memberProfile } = await supabase
            .from("profiles")
            .select("full_name, member_code, phone")
            .eq("id", newRecord.member_id)
            .single();

          if (memberProfile) {
            newRecord.profiles = memberProfile;
          }

          // Sound alert on live scan
          soundEffects.playPunchSuccess();

          setPunches((prev) => [
            newRecord,
            ...prev.filter((p) => p.id !== newRecord.id),
          ]);

          const action = newRecord.punch_type === "in" ? "PUNCHED IN" : "PUNCHED OUT";
          setLiveEventNotice(
            `🔔 ${newRecord.profiles?.full_name || "Member"} ${action} at ${new Date(
              newRecord.punch_time
            ).toLocaleTimeString()}`
          );

          // Clear notice after 5 seconds
          setTimeout(() => {
            setLiveEventNotice(null);
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Compute Currently Inside
  const memberLatestPunch: Record<string, string> = {};
  const punchesAsc = [...punches].reverse();
  punchesAsc.forEach((p) => {
    memberLatestPunch[p.member_id] = p.punch_type;
  });

  const currentlyInsideCount = Object.values(memberLatestPunch).filter(
    (type) => type === "in"
  ).length;

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  // Detect Admin's Current Location via browser Geolocation
  const handleDetectCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocNotice({ type: "error", text: "GPS / Geolocation is not supported by your browser." });
      return;
    }

    setLocDetecting(true);
    setLocNotice(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        const updated = {
          ...locationConfig,
          latitude: lat,
          longitude: lon,
          isEnabled: true,
        };
        setLocationConfig(updated);

        try {
          const res = await fetch("/api/admin/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to save");

          setLocationConfig(data.config);
          setLocNotice({
            type: "success",
            text: `Office location set to: (Lat: ${lat}, Lon: ${lon}) ✅ Members can now punch attendance here.`,
          });
        } catch (e) {
          const err = e as Error;
          setLocNotice({ type: "error", text: err.message || "Failed to save location." });
        } finally {
          setLocDetecting(false);
        }
      },
      (err) => {
        setLocDetecting(false);
        let msg = "Unable to detect location.";
        if (err.code === 1) {
          msg = "GPS permission denied. Please allow location access in your browser settings.";
        }
        setLocNotice({ type: "error", text: msg });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Save updated Office Location settings
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocSaving(true);
    setLocNotice(null);

    try {
      const res = await fetch("/api/admin/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locationConfig),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Location update failed.");
      }

      setLocationConfig(data.config);
      setLocNotice({
        type: "success",
        text: "Office GPS location & geofence settings saved successfully! ✅",
      });

      setTimeout(() => {
        setLocNotice(null);
      }, 5000);
    } catch (err) {
      const error = err as Error;
      setLocNotice({ type: "error", text: error.message || "Failed to save location." });
    } finally {
      setLocSaving(false);
    }
  };

  // Pagination state for Today's Live Punches table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(punches.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPunches = punches.slice((safePage - 1) * pageSize, safePage * pageSize);

  const googleMapsUrl = `https://www.google.com/maps?q=${locationConfig.latitude},${locationConfig.longitude}`;

  return (
    <div className="space-y-6">
      {/* Live Activity Notification Banner */}
      {liveEventNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-3 shadow-md">
          <Radio className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
          <span>{liveEventNotice}</span>
        </div>
      )}

      {/* Top 3 KPI Metric Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-800 mb-1">
            <Users className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-black uppercase tracking-wider">
              Members
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-black font-mono">
            {totalMembers}
          </div>
        </div>

        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-800 mb-1">
            <Fingerprint className="w-4 h-4 text-teal-700" />
            <span className="text-xs font-black uppercase tracking-wider">
              Today&apos;s Punches
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-black font-mono">
            {punches.length}
          </div>
        </div>

        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-800 mb-1">
            <Activity className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-black uppercase tracking-wider">
              Inside Now
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
            {currentlyInsideCount}
          </div>
        </div>
      </div>

      {/* OFFICE GPS GEOFENCING CONFIGURATION CARD */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b-2 border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
              <MapPin className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-black">
                  Office GPS Geofencing
                </h2>
                <span
                  className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                    locationConfig.isEnabled
                      ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  }`}
                >
                  {locationConfig.isEnabled ? "ENFORCED ON" : "DISABLED"}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-semibold mt-0.5">
                Members can only punch attendance within this office location and allowed radius.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDetectCurrentLocation}
              disabled={locDetecting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors shadow-xs"
            >
              {locDetecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-emerald-200" />
              )}
              <span>{locDetecting ? "Setting GPS..." : "📍 Set My Current GPS as Office"}</span>
            </button>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-900 rounded-xl text-xs font-bold transition-colors"
              title="View on Google Maps"
            >
              <span>View Map</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-700" />
            </a>
          </div>
        </div>

        {/* Notice alert */}
        {locNotice && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-xs ${
              locNotice.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                : "bg-rose-50 border-rose-300 text-rose-950"
            }`}
          >
            {locNotice.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{locNotice.text}</span>
          </div>
        )}

        {/* Geofence Form */}
        <form onSubmit={handleSaveLocation} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Latitude input */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                required
                value={locationConfig.latitude}
                onChange={(e) =>
                  setLocationConfig((prev) => ({
                    ...prev,
                    latitude: Number(e.target.value),
                  }))
                }
                placeholder="e.g. 19.076000"
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-sm font-mono font-bold text-black focus:outline-none"
              />
            </div>

            {/* Longitude input */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                required
                value={locationConfig.longitude}
                onChange={(e) =>
                  setLocationConfig((prev) => ({
                    ...prev,
                    longitude: Number(e.target.value),
                  }))
                }
                placeholder="e.g. 72.877700"
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-sm font-mono font-bold text-black focus:outline-none"
              />
            </div>

            {/* Allowed Radius input */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                Allowed Radius
              </label>
              <select
                value={locationConfig.radiusMeters}
                onChange={(e) =>
                  setLocationConfig((prev) => ({
                    ...prev,
                    radiusMeters: Number(e.target.value),
                  }))
                }
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-sm font-bold text-black focus:outline-none"
              >
                <option value={10}>10 meters (Strict Office Only)</option>
              </select>
            </div>

            {/* Office / Gym Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                Office / Gym Name
              </label>
              <input
                type="text"
                value={locationConfig.officeName}
                onChange={(e) =>
                  setLocationConfig((prev) => ({
                    ...prev,
                    officeName: e.target.value,
                  }))
                }
                placeholder="Main Office"
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-sm font-bold text-black focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            {/* Toggle Geofencing switch */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={locationConfig.isEnabled}
                onChange={(e) =>
                  setLocationConfig((prev) => ({
                    ...prev,
                    isEnabled: e.target.checked,
                  }))
                }
                className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
              />
              <span className="text-xs font-black uppercase tracking-wide text-black">
                {locationConfig.isEnabled ? (
                  <span className="text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    GPS Geofence Restriction Active (Punch blocked outside office area)
                  </span>
                ) : (
                  <span className="text-slate-600">
                    GPS Geofence Inactive (Punch allowed from anywhere)
                  </span>
                )}
              </span>
            </label>

            <button
              type="submit"
              disabled={locSaving}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
            >
              {locSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{locSaving ? "Saving..." : "Save Office GPS Settings"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Today's Attendance Table with Live Stream */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-black uppercase tracking-wider text-black">
              Today&apos;s Live Punches
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-950 font-black bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
            <span>REALTIME</span>
          </span>
        </div>

        {punches.length === 0 ? (
          <p className="text-center py-8 text-sm text-slate-600 font-semibold">
            No punches recorded today yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100/90 border-b-2 border-slate-300 text-black uppercase tracking-wider text-xs">
                    <th className="py-3 px-3.5 font-black whitespace-nowrap">Member</th>
                    <th className="py-3 px-3.5 font-black whitespace-nowrap">Time</th>
                    <th className="py-3 px-3.5 font-black whitespace-nowrap">Type</th>
                    <th className="py-3 px-3.5 font-black whitespace-nowrap">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedPunches.map((record) => {
                    const isIn = record.punch_type === "in";
                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3.5 px-3.5 font-bold text-black whitespace-nowrap">
                          <div className="whitespace-nowrap text-sm font-black text-black">{record.profiles?.full_name || "Unknown Member"}</div>
                          <div className="text-xs font-mono font-bold text-emerald-800 whitespace-nowrap mt-0.5">
                            {record.profiles?.member_code}
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 font-mono font-black text-black whitespace-nowrap text-sm">
                          {formatTime(record.punch_time)}
                        </td>
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap ${
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
                                <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
                                <span className="whitespace-nowrap text-emerald-950 font-black">Mobile Biometric</span>
                              </>
                            ) : (
                              <>
                                <Cpu className="w-4 h-4 text-cyan-700 shrink-0" />
                                <span className="whitespace-nowrap text-cyan-950 font-black">{record.method}</span>
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

            {/* PAGINATION CONTROLS BAR */}
            {totalPages > 1 && (
              <div className="bg-slate-100 border-2 border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm pt-3">
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
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span>per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-800 font-mono text-sm font-semibold">
                    Page <strong className="text-black text-sm font-black">{safePage}</strong> of{" "}
                    <strong className="text-black text-sm font-black">{totalPages}</strong>
                  </span>

                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
