"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";

const NAV = [
  { label: "Queue", href: "/analyst/queue", icon: "⏳" },
  { label: "All Applications", href: "/analyst/applications", icon: "📋" },
];

export function AnalystShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm" style={{ background: "#070c1a" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#070c1a" }}>
        <div className="text-center max-w-sm">
          <p className="text-3xl mb-4">🔒</p>
          <h2 className="font-display text-lg font-bold text-white mb-1">Sign in required</h2>
          <p className="text-slate-400 text-sm mb-5">You need to be signed in to access the Analyst Portal.</p>
          <Link href="/analyst/sign-in"
            className="text-sm font-semibold px-5 py-2.5 rounded-xl"
            style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)", color: "#070c1a" }}>
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== "ANALYST" && user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-3xl mb-4">⛔</p>
          <h2 className="font-display text-lg font-bold text-slate-900 mb-2">Access denied</h2>
          <p className="text-slate-500 text-sm mb-6">
            You are signed in as <span className="font-medium text-slate-700">{user.firstName} {user.lastName}</span>{" "}
            ({user.role.replace("_", " ").toLowerCase()}). Analyst accounts only.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard"
              className="border border-slate-200 text-slate-600 text-sm font-medium px-5 py-2.5 rounded-xl hover:border-slate-400 transition-colors">
              Back to Dashboard
            </Link>
            <button onClick={() => { logout(); router.push("/analyst/sign-in"); }}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl"
              style={{ background: "#070c1a", color: "white" }}>
              Sign in as Analyst
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#f8fafc" }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col sticky top-0 h-screen"
        style={{ background: "#070c1a", borderRight: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
              style={{ background: "linear-gradient(135deg, #f5a623, #e8920f)" }}>☀</span>
            <span className="font-display font-bold text-white text-sm">SolarCredit</span>
          </div>
          <p className="text-xs font-semibold tracking-widest uppercase mt-1" style={{ color: "rgba(245,166,35,0.7)" }}>
            Analyst Portal
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={active
                  ? { background: "rgba(245,166,35,0.15)", color: "#f5a623", borderLeft: "3px solid #f5a623", paddingLeft: "9px" }
                  : { color: "rgba(255,255,255,0.5)" }
                }>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "rgba(245,166,35,0.2)", color: "#f5a623" }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{user.role}</p>
            </div>
          </div>
          <button onClick={() => { logout(); router.push("/analyst/sign-in"); }}
            className="text-xs transition-colors hover:text-red-400"
            style={{ color: "rgba(255,255,255,0.3)" }}>
            Sign out →
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
