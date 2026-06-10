"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AnalystShell } from "@/components/layout/analyst-shell";
import { parseApiError } from "@/lib/errors";

interface QueueItem {
  id: string;
  applicationId: string;
  assignedAt: string;
  application: {
    referenceNumber: string;
    amountRequested: number;
    commodityType: string;
    tenor: number;
    submittedAt: string;
    business: { registeredName: string; state: string };
    creditProfile?: { totalScore: number; scoreGrade: string; recommendation: string };
  };
}

const GRADE_STYLES: Record<string, string> = {
  A: "text-green-700 bg-green-50 border-green-200",
  B: "text-blue-700 bg-blue-50 border-blue-200",
  C: "text-yellow-700 bg-yellow-50 border-yellow-200",
  D: "text-orange-700 bg-orange-50 border-orange-200",
  F: "text-red-700 bg-red-50 border-red-200",
};

const REC_STYLES: Record<string, string> = {
  APPROVE: "text-green-700 bg-green-50",
  REVIEW: "text-yellow-700 bg-yellow-50",
  DECLINE: "text-red-700 bg-red-50",
};

export default function AnalystQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/analyst/queue")
      .then((r) => setQueue(r.data.data))
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AnalystShell>
      <div className="px-8 py-7">
        <div className="mb-7">
          <h1 className="text-xl font-bold text-slate-900">My Queue</h1>
          <p className="text-slate-500 text-sm mt-0.5">Applications assigned to you awaiting a decision</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : queue.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400">Your queue is empty.</p>
            <Link href="/analyst/applications" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              Browse all submitted applications →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => {
              const app = item.application;
              const profile = app.creditProfile;
              return (
                <Link
                  key={item.id}
                  href={`/analyst/applications/${item.applicationId}`}
                  className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-400 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900">{app.business.registeredName}</span>
                        <span className="text-xs text-slate-400 font-mono">{app.referenceNumber.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {app.commodityType.replace(/_/g, " ")} · ₦{Number(app.amountRequested).toLocaleString()} · {app.tenor} months · {app.business.state}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Submitted {new Date(app.submittedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    {profile ? (
                      <div className="flex items-center gap-3 ml-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-md ${REC_STYLES[profile.recommendation] ?? "text-slate-600 bg-slate-50"}`}>
                          {profile.recommendation}
                        </span>
                        <div className={`text-center px-4 py-2 rounded-xl border font-bold text-lg ${GRADE_STYLES[profile.scoreGrade] ?? "text-slate-600 bg-slate-50 border-slate-200"}`}>
                          {profile.scoreGrade}
                          <div className="text-xs font-normal">{profile.totalScore}/100</div>
                        </div>
                      </div>
                    ) : (
                      <span className="ml-4 text-xs text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                        No profile yet
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AnalystShell>
  );
}
