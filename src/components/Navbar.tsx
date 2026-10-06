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

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={userRole === "admin" ? "/admin" : "/member"} className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-sm tracking-wide text-slate-900 uppercase block leading-none">
              IronVault
            </span>
            <span className="text-[10px] text-emerald-600 font-bold tracking-wider uppercase block mt-0.5">
              Biometric Punch
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {memberCode && (
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-800">{memberName || "Member"}</div>
              <div className="text-[10px] font-mono font-bold text-emerald-600">{memberCode}</div>
            </div>
          )}

          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Subnav */}
      <nav className="max-w-md mx-auto px-4 pb-2 pt-1 flex items-center justify-around text-xs border-t border-slate-100">
        {userRole === "admin" ? (
          <>
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors ${
                pathname === "/admin"
                  ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Overview</span>
            </Link>
            <Link
              href="/admin/members"
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors ${
                pathname === "/admin/members"
                  ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Members</span>
            </Link>
            <Link
              href="/admin/attendance"
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors ${
                pathname === "/admin/attendance"
                  ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Logs</span>
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/member"
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors ${
                pathname === "/member" || pathname === "/member/punch"
                  ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5" />
              <span>Punch</span>
            </Link>
            <Link
              href="/member/register-biometric"
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors ${
                pathname === "/member/register-biometric"
                  ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Biometric Setup</span>
            </Link>
            <Link
              href="/member/attendance"
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors ${
                pathname === "/member/attendance"
                  ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>History</span>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
