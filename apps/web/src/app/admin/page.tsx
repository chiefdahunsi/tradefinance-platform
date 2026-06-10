"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AdminShell } from "@/components/layout/admin-shell";
import { parseApiError } from "@/lib/errors";

interface Stats {
  users: { total: number; sme: number; analysts: number };
  applications: { total: number; byStatus: Record<string, number> };
  businesses: number;
  kyc: { passed: number; failed: number; pending: number };
  recentApplications: {
    id: string;
    referenceNumber: string;
    status: string;
    amountRequested: number;
    createdAt: string;
    business: { registeredName: string };
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-zinc-400",
  SUBMITTED: "text-blue-400",
  KYC_PENDING: "text-yellow-400",
  KYC_VERIFIED: "text-cyan-400",
  KYC_FAILED: "text-red-400",
  UNDER_REVIEW: "text-purple-400",
  APPROVED: "text-green-400",
  DECLINED: "text-red-400",
  MORE_INFO_REQUIRED: "text-orange-400",
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/admin/stats")
      .then((r) => setStats(r.data.data))
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell>
      <div className="px-8 py-7 max-w-5xl">
        <div className="mb-7">
          <h1 className="text-xl font-bold text-white">Platform Overview</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Real-time platform statistics</p>
        </div>

        {error && (
          <div className="mb-5 bg-red-950/50 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        {loading ? (
          <div className="text-zinc-500 text-sm">Loading...</div>
        ) : stats ? (
          <div className="space-y-6">

            {/* Top KPI cards */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Users" value={stats.users.total} sub={`${stats.users.sme} applicants · ${stats.users.analysts} analysts`} />
              <StatCard label="Businesses" value={stats.businesses} />
              <StatCard label="Applications" value={stats.applications.total} />
              <StatCard
                label="KYC Pass Rate"
                value={
                  stats.kyc.passed + stats.kyc.failed > 0
                    ? `${Math.round((stats.kyc.passed / (stats.kyc.passed + stats.kyc.failed)) * 100)}%`
                    : "—"
                }
                sub={`${stats.kyc.passed} passed · ${stats.kyc.failed} failed`}
              />
            </div>

            {/* Application pipeline */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Application Pipeline</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Draft", key: "DRAFT" },
                  { label: "Submitted", key: "SUBMITTED" },
                  { label: "KYC Pending", key: "KYC_PENDING" },
                  { label: "KYC Verified", key: "KYC_VERIFIED" },
                  { label: "KYC Failed", key: "KYC_FAILED" },
                  { label: "Under Review", key: "UNDER_REVIEW" },
                  { label: "Approved", key: "APPROVED" },
                  { label: "Declined", key: "DECLINED" },
                  { label: "More Info", key: "MORE_INFO_REQUIRED" },
                ].map(({ label, key }) => (
                  <div key={key} className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-3">
                    <span className="text-xs text-zinc-400">{label}</span>
                    <span className={`text-sm font-bold ${STATUS_COLORS[key] ?? "text-white"}`}>
                      {stats.applications.byStatus[key] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* KYC breakdown */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
              <h2 className="text-sm font-semibold text-white mb-4">KYC Checks</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">{stats.kyc.passed}</div>
                  <div className="text-xs text-zinc-500 mt-1">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-400">{stats.kyc.pending}</div>
                  <div className="text-xs text-zinc-500 mt-1">Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-400">{stats.kyc.failed}</div>
                  <div className="text-xs text-zinc-500 mt-1">Failed</div>
                </div>
              </div>
              {/* Pass rate bar */}
              {stats.kyc.passed + stats.kyc.failed > 0 && (
                <div className="mt-4">
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.round((stats.kyc.passed / (stats.kyc.passed + stats.kyc.failed + stats.kyc.pending)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Recent applications */}
            {stats.recentApplications.length > 0 && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-white">Recent Applications</h2>
                  <Link href="/admin/users" className="text-xs text-zinc-400 hover:text-white transition-colors">
                    View all users →
                  </Link>
                </div>
                <div className="space-y-2">
                  {stats.recentApplications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-white">{app.business.registeredName}</p>
                        <p className="text-xs text-zinc-500 font-mono">{app.referenceNumber.slice(0, 8).toUpperCase()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-300">₦{Number(app.amountRequested).toLocaleString()}</p>
                        <span className={`text-xs ${STATUS_COLORS[app.status] ?? "text-zinc-400"}`}>
                          {app.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
      <p className="text-xs text-zinc-500 font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}
