"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface QueueItem {
  id: string;
  applicationId: string;
  assignedAt: string;
  application: {
    referenceNumber: string;
    amountRequested: number;
    commodityType: string;
    tenor: number;
    status: string;
    business: { registeredName: string; commodities: string[] };
    creditProfile?: { totalScore: number; scoreGrade: string; recommendation: string };
  };
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-green-600 bg-green-50",
  B: "text-blue-600 bg-blue-50",
  C: "text-yellow-600 bg-yellow-50",
  D: "text-orange-600 bg-orange-50",
  F: "text-red-600 bg-red-50",
};

export default function AnalystQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/analyst/queue")
      .then((r) => setQueue(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-bold text-slate-900">Analyst Queue</h1>
        <p className="text-slate-500 text-sm">{queue.length} application(s) awaiting decision</p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading...</div>
        ) : queue.length === 0 ? (
          <div className="text-center py-20 text-slate-400">Queue is empty.</div>
        ) : (
          <div className="space-y-4">
            {queue.map((item) => {
              const app = item.application;
              const profile = app.creditProfile;
              return (
                <Link
                  key={item.id}
                  href={`/analyst/applications/${item.applicationId}`}
                  className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-400 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {app.business.registeredName}
                      </p>
                      <p className="text-slate-500 text-sm mt-0.5">
                        {app.commodityType} ·{" "}
                        {Number(app.amountRequested).toLocaleString("en-NG", {
                          style: "currency",
                          currency: "NGN",
                          maximumFractionDigits: 0,
                        })}{" "}
                        · {app.tenor} months
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Assigned {new Date(item.assignedAt).toLocaleDateString("en-NG")}
                      </p>
                    </div>
                    {profile ? (
                      <div className="text-center">
                        <div
                          className={`text-3xl font-bold px-4 py-2 rounded-xl ${GRADE_COLORS[profile.scoreGrade] ?? "text-slate-600 bg-slate-50"}`}
                        >
                          {profile.scoreGrade}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Score: {profile.totalScore}/100
                        </p>
                        <p className="text-xs font-medium text-slate-600">
                          {profile.recommendation}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">
                        No profile yet
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
