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
    systemType: string;
    tenor: number;
    submittedAt: string;
    business: { registeredName: string; state: string };
    creditProfile?: { totalScore: number; scoreGrade: string; recommendation: string };
  };
}

const GRADE_COLOR: Record<string, string> = {
  A: "#16a34a", B: "#65a30d", C: "#d97706", D: "#ea580c", E: "#dc2626", F: "#9f1239",
};

const REC_META: Record<string, { label: string; color: string; bg: string }> = {
  APPROVE:  { label: "Approve",  color: "#15803d", bg: "rgba(22,163,74,0.12)" },
  REVIEW:   { label: "Review",   color: "#d97706", bg: "rgba(217,119,6,0.12)" },
  DECLINE:  { label: "Decline",  color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
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
        <div className="mb-7 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">My Queue</h1>
            <p className="text-slate-500 text-sm mt-0.5">Applications assigned to you awaiting a decision</p>
          </div>
          {queue.length > 0 && (
            <span className="text-sm font-semibold px-3 py-1 rounded-full"
              style={{ background: "rgba(245,166,35,0.12)", color: "#92400e" }}>
              {queue.length} pending
            </span>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {loading ? (
          <div className="text-slate-400 text-sm">Loading…</div>
        ) : queue.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <div className="text-3xl mb-3">📭</div>
            <p className="font-display font-semibold text-slate-700 mb-1">Your queue is empty</p>
            <p className="text-slate-400 text-sm mb-5">No applications are assigned to you right now.</p>
            <Link href="/analyst/applications"
              className="text-sm font-semibold px-4 py-2 rounded-xl"
              style={{ background: "rgba(245,166,35,0.12)", color: "#92400e" }}>
              Browse all applications →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => {
              const app = item.application;
              const profile = app.creditProfile;
              const rec = profile ? REC_META[profile.recommendation] : null;
              const gradeColor = profile ? (GRADE_COLOR[profile.scoreGrade] ?? "#64748b") : null;
              return (
                <Link key={item.id} href={`/analyst/applications/${item.applicationId}`}
                  className="block bg-white rounded-2xl border border-slate-100 p-5 hover:border-slate-300 hover:shadow-sm transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="font-display font-semibold text-slate-900">{app.business.registeredName}</span>
                        <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                          {app.referenceNumber.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {app.systemType.replace(/_/g, " ")} Solar · ₦{Number(app.amountRequested).toLocaleString()} · {app.tenor} months · {app.business.state}
                      </p>
                      <p className="text-xs text-slate-400 mt-1.5">
                        Submitted {new Date(app.submittedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      {profile ? (
                        <>
                          {rec && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                              style={{ color: rec.color, background: rec.bg }}>
                              {rec.label}
                            </span>
                          )}
                          <div className="text-right">
                            <div className="font-display font-bold text-2xl leading-tight" style={{ color: gradeColor ?? "#64748b" }}>
                              {profile.scoreGrade}
                            </div>
                            <div className="text-xs text-slate-400">{profile.totalScore}/100</div>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">No profile yet</span>
                      )}
                      <span className="text-slate-300 group-hover:text-slate-500 transition-colors">→</span>
                    </div>
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
