"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dumbbell, LogOut, ShieldCheck, UserCheck, Fingerprint, CalendarCheck } from "lucide-react";

interface NavbarProps {
  userRole?: "admin" | "member";
  memberName?: string;
  memberCode?: string;
}

export default function Navbar({ userRole = "member", memberName, memberCode }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isAdmin = userRole === "admin";

  const adminNavItems = [
    { href: "/admin", label: "Overview", icon: ShieldCheck, mobileLabel: "Overview" },
    { href: "/admin/members", label: "Members", icon: UserCheck, mobileLabel: "Members" },
    { href: "/admin/attendance", label: "Attendance Logs", icon: CalendarCheck, mobileLabel: "Logs" },
  ];

  const memberNavItems = [
    { href: "/member", label: "Punch Terminal", icon: Fingerprint, mobileLabel: "Punch" },
    { href: "/member/register-biometric", label: "Biometric Setup", icon: ShieldCheck, mobileLabel: "Biometric" },
    { href: "/member/attendance", label: "Attendance History", icon: CalendarCheck, mobileLabel: "History" },
  ];

  const currentNavItems = isAdmin ? adminNavItems : memberNavItems;

  return (
    <header className="sticky top-0 z-50 bg-white border-b-2 border-slate-200 shadow-xs">
      {/* Top Header Bar: Expanded width for big screens, compact for mobile */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <Link href={isAdmin ? "/admin" : "/member"} className="flex items-center gap-3 group shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg tracking-wide text-black uppercase block leading-none">
                IronVault
              </span>
              <span
                className={`hidden sm:inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isAdmin
                    ? "bg-slate-900 text-emerald-400 border-slate-700"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                }`}
              >
                {isAdmin ? "Admin Portal" : "Member Portal"}
              </span>
            </div>
            <span className="text-[11px] sm:text-xs text-emerald-700 font-black tracking-wider uppercase block mt-1">
              Biometric Punch System
            </span>
          </div>
        </Link>

        {/* Big Screen Navigation (Hidden on mobile, clean inline nav on desktop) */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {currentNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/member"
                ? pathname === "/member" || pathname === "/member/punch"
                : pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-2 text-sm font-black transition-all ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-700 hover:text-black hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Sign Out */}
        <div className="flex items-center gap-3 shrink-0">
          {memberCode && (
            <div className="text-right hidden sm:block">
              <div className="text-sm font-black text-black leading-tight">
                {memberName || (isAdmin ? "Administrator" : "Member")}
              </div>
              <div className="text-xs font-mono font-black text-emerald-800">
                {memberCode}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            title="Sign out"
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-800 hover:text-rose-700 border-2 border-slate-300 hover:border-rose-300 transition-colors text-xs font-black"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Subnav: Kept exactly as is on mobile devices (< md screens) */}
      <nav className="md:hidden max-w-xl mx-auto px-3 pb-2.5 pt-1.5 flex items-center justify-around text-xs font-bold border-t border-slate-200">
        {currentNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/member"
              ? pathname === "/member" || pathname === "/member/punch"
              : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors ${
                isActive
                  ? "bg-emerald-600 text-white font-black shadow-xs"
                  : "text-slate-800 hover:text-black hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
