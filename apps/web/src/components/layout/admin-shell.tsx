"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";

const NAV = [
  { label: "Overview", href: "/admin", icon: "📊", exact: true },
  { label: "Users", href: "/admin/users", icon: "👥" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-lg font-bold text-white mb-1">Sign in required</h2>
          <p className="text-zinc-400 text-sm mb-5">You need to be signed in to access the Admin Panel.</p>
          <Link href="/admin/sign-in" className="bg-white text-zinc-900 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors">
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">⛔</p>
          <h2 className="text-lg font-bold text-white mb-2">Access denied</h2>
          <p className="text-zinc-400 text-sm mb-1">
            You are signed in as{" "}
            <span className="font-medium text-zinc-200">{user.firstName} {user.lastName}</span>{" "}
            ({user.role.replace("_", " ").toLowerCase()}).
          </p>
          <p className="text-zinc-400 text-sm mb-6">
            The Admin Panel requires an administrator account.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { logout(); router.push("/admin/sign-in"); }}
              className="bg-white text-zinc-900 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Sign in as Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="px-5 py-5 border-b border-zinc-800">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">SolarCredit</p>
          <p className="text-sm font-bold text-white mt-0.5">Admin Panel</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white text-zinc-900"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-zinc-800">
          <p className="text-xs font-medium text-zinc-300">{user.firstName} {user.lastName}</p>
          <p className="text-xs text-zinc-500 mb-2">{user.email}</p>
          <button
            onClick={() => { logout(); router.push("/admin/sign-in"); }}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-zinc-950">{children}</main>
    </div>
  );
}
