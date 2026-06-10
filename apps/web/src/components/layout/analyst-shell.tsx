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

  // Still hydrating auth from localStorage — avoid flash
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
        Loading...
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Sign in required</h2>
          <p className="text-slate-500 text-sm mb-5">
            You need to be signed in to access the Analyst Portal.
          </p>
          <Link
            href="/analyst/sign-in"
            className="bg-slate-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Signed in with wrong role
  if (user.role !== "ANALYST" && user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">⛔</p>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Access denied</h2>
          <p className="text-slate-500 text-sm mb-1">
            You are signed in as{" "}
            <span className="font-medium text-slate-700">
              {user.firstName} {user.lastName}
            </span>{" "}
            ({user.role.replace("_", " ").toLowerCase()}).
          </p>
          <p className="text-slate-500 text-sm mb-6">
            The Analyst Portal is only available to analyst accounts. Please sign
            in with an analyst account to continue.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/dashboard"
              className="border border-slate-200 text-slate-600 text-sm font-medium px-5 py-2.5 rounded-lg hover:border-slate-400 transition-colors"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={() => {
                logout();
                router.push("/analyst/sign-in");
              }}
              className="bg-slate-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Sign in as Analyst
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">TradeFinance</p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">Analyst Portal</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-700">{user.firstName} {user.lastName}</p>
          <p className="text-xs text-slate-400 mb-2">{user.email}</p>
          <button
            onClick={() => { logout(); router.push("/analyst/sign-in"); }}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
