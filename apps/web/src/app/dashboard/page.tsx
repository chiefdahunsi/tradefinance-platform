"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Application {
  id: string;
  referenceNumber: string;
  status: string;
  amountRequested: number;
  commodityType: string;
  tenor: number;
  createdAt: string;
  creditProfile?: { totalScore: number; scoreGrade: string };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  KYC_PENDING: "bg-yellow-100 text-yellow-700",
  KYC_VERIFIED: "bg-green-100 text-green-700",
  KYC_FAILED: "bg-red-100 text-red-700",
  UNDER_REVIEW: "bg-purple-100 text-purple-700",
  APPROVED: "bg-green-100 text-green-800 font-semibold",
  DECLINED: "bg-red-100 text-red-800",
  MORE_INFO_REQUIRED: "bg-orange-100 text-orange-700",
};

export default function DashboardPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/applications/mine")
      .then((r) => setApplications(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">My Applications</h1>
        <Link
          href="/dashboard/apply"
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Application
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading...</div>
        ) : applications.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-500 mb-4">No applications yet.</p>
            <Link
              href="/dashboard/apply"
              className="text-green-600 font-medium hover:underline"
            >
              Start your first application →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <Link
                key={app.id}
                href={`/dashboard/applications/${app.id}`}
                className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-green-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-xs text-slate-400">
                        {app.referenceNumber.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {app.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium">
                      {app.commodityType} —{" "}
                      {Number(app.amountRequested).toLocaleString("en-NG", {
                        style: "currency",
                        currency: "NGN",
                        maximumFractionDigits: 0,
                      })}{" "}
                      · {app.tenor} months
                    </p>
                  </div>
                  <div className="text-right">
                    {app.creditProfile && (
                      <div className="text-2xl font-bold text-slate-900">
                        {app.creditProfile.totalScore}
                        <span className="text-sm font-normal text-slate-500 ml-1">
                          / 100
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(app.createdAt).toLocaleDateString("en-NG")}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
