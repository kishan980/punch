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
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={userRole === "admin" ? "/admin" : "/member"} className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-950/40 group-hover:scale-105 transition-transform">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-sm tracking-wide text-white uppercase block leading-none">
              IronVault
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase block mt-0.5">
              Biometric Punch
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {memberCode && (
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-200">{memberName || "Member"}</div>
              <div className="text-[10px] font-mono text-emerald-400">{memberCode}</div>
            </div>
          )}

          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Subnav */}
      <nav className="max-w-md mx-auto px-4 pb-2 pt-1 flex items-center justify-around text-xs border-t border-slate-800/50">
        {userRole === "admin" ? (
          <>
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                pathname === "/admin"
                  ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Overview</span>
            </Link>
            <Link
              href="/admin/members"
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                pathname === "/admin/members"
                  ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Members</span>
            </Link>
            <Link
              href="/admin/attendance"
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                pathname === "/admin/attendance"
                  ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
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
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                pathname === "/member" || pathname === "/member/punch"
                  ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5" />
              <span>Punch</span>
            </Link>
            <Link
              href="/member/register-biometric"
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                pathname === "/member/register-biometric"
                  ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Biometric Setup</span>
            </Link>
            <Link
              href="/member/attendance"
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                pathname === "/member/attendance"
                  ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
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
