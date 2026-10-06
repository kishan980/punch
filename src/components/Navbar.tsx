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
    <header className="sticky top-0 z-50 bg-white border-b-2 border-slate-200 shadow-xs">
      <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <Link href={userRole === "admin" ? "/admin" : "/member"} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-base tracking-wide text-black uppercase block leading-none">
              IronVault
            </span>
            <span className="text-xs text-emerald-700 font-black tracking-wider uppercase block mt-1">
              Biometric Punch
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {memberCode && (
            <div className="text-right hidden sm:block">
              <div className="text-sm font-black text-black">{memberName || "Member"}</div>
              <div className="text-xs font-mono font-black text-emerald-800">{memberCode}</div>
            </div>
          )}

          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-800 hover:text-rose-700 border-2 border-slate-300 transition-colors font-bold"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Subnav with boosted font size and high contrast */}
      <nav className="max-w-xl mx-auto px-4 pb-2.5 pt-1.5 flex items-center justify-around text-sm font-bold border-t border-slate-200">
        {userRole === "admin" ? (
          <>
            <Link
              href="/admin"
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                pathname === "/admin"
                  ? "bg-emerald-600 text-white font-black shadow-xs"
                  : "text-slate-800 hover:text-black hover:bg-slate-100"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Overview</span>
            </Link>
            <Link
              href="/admin/members"
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                pathname === "/admin/members"
                  ? "bg-emerald-600 text-white font-black shadow-xs"
                  : "text-slate-800 hover:text-black hover:bg-slate-100"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Members</span>
            </Link>
            <Link
              href="/admin/attendance"
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                pathname === "/admin/attendance"
                  ? "bg-emerald-600 text-white font-black shadow-xs"
                  : "text-slate-800 hover:text-black hover:bg-slate-100"
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Logs</span>
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/member"
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                pathname === "/member" || pathname === "/member/punch"
                  ? "bg-emerald-600 text-white font-black shadow-xs"
                  : "text-slate-800 hover:text-black hover:bg-slate-100"
              }`}
            >
              <Fingerprint className="w-4 h-4" />
              <span>Punch</span>
            </Link>
            <Link
              href="/member/register-biometric"
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                pathname === "/member/register-biometric"
                  ? "bg-emerald-600 text-white font-black shadow-xs"
                  : "text-slate-800 hover:text-black hover:bg-slate-100"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Biometric Setup</span>
            </Link>
            <Link
              href="/member/attendance"
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                pathname === "/member/attendance"
                  ? "bg-emerald-600 text-white font-black shadow-xs"
                  : "text-slate-800 hover:text-black hover:bg-slate-100"
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>History</span>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
