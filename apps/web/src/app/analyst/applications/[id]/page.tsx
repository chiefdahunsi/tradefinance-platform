"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AnalystShell } from "@/components/layout/analyst-shell";
import { Spinner } from "@/components/shared/spinner";
import { DocumentLink } from "@/components/shared/document-link";
import { parseApiError } from "@/lib/errors";

interface FullApplication {
  id: string;
  referenceNumber: string;
  status: string;
  amountRequested: number;
  tenor: number;
  systemType: string;
  systemSizeKwp?: number;
  projectAddress?: string;
  purpose: string;
  projectDescription: string;
  collateralType?: string;
  collateralValue?: number;
  collateralDetails?: string;
  submittedAt: string;
  business: {
    registeredName: string;
    tradingName?: string;
    cacNumber: string;
    taxId?: string;
    businessType: string;
    sector: string;
    address: string;
    city: string;
    state: string;
    website?: string;
    commodities: string[];
    yearsInOperation?: number;
    annualTurnover?: number;
    exportMarkets: string[];
    directors: {
      id: string;
      firstName: string;
      lastName: string;
      bvn: string;
      phone: string;
      email: string;
      percentOwned: number;
      kycStatus: string;
    }[];
  };
  documents: {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
    status: string;
    rejectionReason?: string;
    uploadedAt: string;
  }[];
  kycChecks: {
    id: string;
    checkType: string;
    provider: string;
    status: string;
    notes?: string;
    checkedAt: string;
    rawResponse?: Record<string, any> | null;
  }[];
  creditProfile?: {
    totalScore: number;
    scoreGrade: string;
    recommendation: string;
    kycScore: number;
    financialScore: number;
    projectViabilityScore: number;
    collateralScore: number;
    bureauScore: number | null;
    bureauProvider: string | null;
    bureauReference: string | null;
    summary: string;
    strengths: string[];
    risks: string[];
    conditions: string[];
    generatedAt: string;
  };
  analystReview?: {
    id: string;
    decision?: string;
    amountApproved?: number;
    tenorApproved?: number;
    interestRate?: number;
    conditions: string[];
    notes?: string;
    internalNotes?: string;
    decidedAt?: string;
    analyst: { firstName: string; lastName: string; email: string };
  };
}

const KYC_STYLES: Record<string, string> = {
  PASSED: "text-green-700 bg-green-50",
  FAILED: "text-red-700 bg-red-50",
  PENDING: "text-yellow-700 bg-yellow-50",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
};

export default function AnalystApplicationPage() {
  const { id } = useParams();
  const router = useRouter();
  const [app, setApp] = useState<FullApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingProfile, setGeneratingProfile] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [runningKyc, setRunningKyc] = useState(false);
  const [runningBvn, setRunningBvn] = useState<Record<string, boolean>>({});
  const [runningCac, setRunningCac] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "kyc" | "decision">("overview");
  const [reviewingDoc, setReviewingDoc] = useState<string | null>(null);
  const [rejectionInputs, setRejectionInputs] = useState<Record<string, string>>({});
  const [showRejectionBox, setShowRejectionBox] = useState<Record<string, boolean>>({});

  const handleDocReview = async (docId: string, status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && !rejectionInputs[docId]?.trim()) {
      setShowRejectionBox((p) => ({ ...p, [docId]: true }));
      return;
    }
    setReviewingDoc(docId);
    try {
      await api.patch(`/api/documents/${docId}/review`, {
        status,
        rejectionReason: rejectionInputs[docId] || undefined,
      });
      setShowRejectionBox((p) => ({ ...p, [docId]: false }));
      await fetchApp();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Review failed");
    } finally {
      setReviewingDoc(null);
    }
  };

  const [decision, setDecision] = useState({
    decision: "",
    amountApproved: "",
    tenorApproved: "",
    interestRate: "",
    conditions: "",
    notes: "",
    internalNotes: "",
  });

  const fetchApp = () =>
    api.get(`/api/applications/${id}`)
      .then((r) => {
        setApp(r.data.data);
        if (r.data.data.analystReview?.decision) {
          const rev = r.data.data.analystReview;
          setDecision({
            decision: rev.decision || "",
            amountApproved: rev.amountApproved?.toString() || "",
            tenorApproved: rev.tenorApproved?.toString() || "",
            interestRate: rev.interestRate?.toString() || "",
            conditions: rev.conditions?.join("\n") || "",
            notes: rev.notes || "",
            internalNotes: rev.internalNotes || "",
          });
        }
      })
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoading(false));

  useEffect(() => { fetchApp(); }, [id]);

  const runAllKyc = async () => {
    setRunningKyc(true);
    setError("");
    try {
      await api.post(`/api/kyc/run/${id}`);
      await fetchApp();
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setRunningKyc(false);
    }
  };

  const runBvn = async (directorId: string, bvn: string, dateOfBirth: string) => {
    setRunningBvn((p) => ({ ...p, [directorId]: true }));
    setError("");
    try {
      await api.post(`/api/kyc/bvn`, { directorId, bvn, dateOfBirth: dateOfBirth || "1900-01-01" });
      await fetchApp();
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setRunningBvn((p) => ({ ...p, [directorId]: false }));
    }
  };

  const runCac = async () => {
    setRunningCac(true);
    setError("");
    try {
      await api.post(`/api/kyc/cac`, { applicationId: id, cacNumber: app!.business.cacNumber });
      await fetchApp();
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setRunningCac(false);
    }
  };

  const generateProfile = async () => {
    setGeneratingProfile(true);
    setError("");
    try {
      await api.post(`/api/analyst/${id}/generate-profile`);
      await fetchApp();
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setGeneratingProfile(false);
    }
  };

  const submitDecision = async () => {
    if (!decision.decision) { setError("Please select a decision."); return; }
    setSubmittingDecision(true);
    setError("");
    try {
      await api.post(`/api/analyst/${id}/decision`, {
        ...decision,
        amountApproved: decision.amountApproved ? parseFloat(decision.amountApproved) : undefined,
        tenorApproved: decision.tenorApproved ? parseInt(decision.tenorApproved) : undefined,
        interestRate: decision.interestRate ? parseFloat(decision.interestRate) : undefined,
        conditions: decision.conditions ? decision.conditions.split("\n").filter(Boolean) : [],
      });
      await fetchApp();
      setActiveTab("overview");
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setSubmittingDecision(false);
    }
  };

  if (loading) return (
    <AnalystShell>
      <div className="flex items-center justify-center h-screen text-slate-400">
        <Spinner className="w-6 h-6" />
      </div>
    </AnalystShell>
  );

  if (!app) return (
    <AnalystShell>
      <div className="flex items-center justify-center h-screen text-slate-400">Application not found.</div>
    </AnalystShell>
  );

  const hasDecision = !!app.analystReview?.decision;

  return (
    <AnalystShell>
      <div className="px-8 py-7 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600 text-sm mb-2 flex items-center gap-1">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-slate-900">{app.business.registeredName}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {app.systemType.replace(/_/g, " ")} Solar · ₦{Number(app.amountRequested).toLocaleString()} · {app.tenor} months ·{" "}
              <span className="font-mono">{app.referenceNumber.slice(0, 8).toUpperCase()}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runAllKyc}
              disabled={runningKyc}
              className="flex items-center gap-2 border border-slate-200 hover:border-slate-400 disabled:opacity-50 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {runningKyc ? <><Spinner /> Running...</> : "↺ Run All KYC"}
            </button>
            {!hasDecision && (
              <button
                onClick={generateProfile}
                disabled={generatingProfile}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {generatingProfile ? <><Spinner /> Generating...</> : "⚡ Generate Credit Profile"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Credit score banner */}
        {app.creditProfile && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5 flex items-center gap-6">
            <div className="text-center">
              <div className={`text-5xl font-bold ${SCORE_COLOR(app.creditProfile.totalScore)}`}>
                {app.creditProfile.totalScore}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Credit Score</div>
            </div>
            <div className="h-12 w-px bg-slate-200" />
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-900">Grade {app.creditProfile.scoreGrade}</div>
              <div className={`text-xs font-semibold mt-0.5 ${
                app.creditProfile.recommendation === "APPROVE" ? "text-green-600" :
                app.creditProfile.recommendation === "DECLINE" ? "text-red-600" : "text-yellow-600"
              }`}>{app.creditProfile.recommendation}</div>
            </div>
            <div className="h-12 w-px bg-slate-200" />
            <div className="flex-1 grid grid-cols-5 gap-3 text-center">
              {[
                { label: "KYC", score: app.creditProfile.kycScore },
                { label: "Financial", score: app.creditProfile.financialScore },
                { label: "Project Viability", score: app.creditProfile.projectViabilityScore },
                { label: "Collateral", score: app.creditProfile.collateralScore },
              ].map(({ label, score }) => (
                <div key={label}>
                  <div className={`text-lg font-bold ${SCORE_COLOR(score)}`}>{score}</div>
                  <div className="text-xs text-slate-400">{label}</div>
                </div>
              ))}
              <div>
                {app.creditProfile.bureauScore !== null && app.creditProfile.bureauScore !== undefined ? (
                  <>
                    <div className={`text-lg font-bold ${SCORE_COLOR(app.creditProfile.bureauScore)}`}>
                      {app.creditProfile.bureauScore}
                    </div>
                    <div className="text-xs text-slate-400">Bureau</div>
                    <div className="text-xs text-slate-300">{app.creditProfile.bureauProvider}</div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold text-slate-300">—</div>
                    <div className="text-xs text-slate-300">Bureau</div>
                  </>
                )}
              </div>
            </div>
            {hasDecision && (
              <>
                <div className="h-12 w-px bg-slate-200" />
                <div className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                  app.analystReview?.decision === "APPROVED" ? "bg-green-100 text-green-800" :
                  app.analystReview?.decision === "DECLINED" ? "bg-red-100 text-red-800" :
                  "bg-orange-100 text-orange-800"
                }`}>
                  {app.analystReview?.decision}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 mb-5">
          {(["overview", "documents", "kyc", "decision"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "decision" && !hasDecision ? "📝 Decision" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "documents" && ` (${app.documents.length})`}
              {tab === "kyc" && ` (${app.kycChecks.length})`}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Credit profile summary */}
            {app.creditProfile && (
              <Section title="Credit Analysis">
                <p className="text-sm text-slate-600 mb-4">{app.creditProfile.summary}</p>
                <div className="grid grid-cols-2 gap-5">
                  {app.creditProfile.strengths.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-700 mb-2">✓ Strengths</p>
                      <ul className="space-y-1">
                        {app.creditProfile.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-slate-600 flex gap-2"><span className="text-green-400">•</span>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {app.creditProfile.risks.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-600 mb-2">⚠ Risks</p>
                      <ul className="space-y-1">
                        {app.creditProfile.risks.map((r, i) => (
                          <li key={i} className="text-sm text-slate-600 flex gap-2"><span className="text-red-400">•</span>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {app.creditProfile.conditions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Suggested Conditions</p>
                    <ul className="space-y-1">
                      {app.creditProfile.conditions.map((c, i) => (
                        <li key={i} className="text-sm text-slate-600">• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {app.creditProfile.bureauScore !== null && app.creditProfile.bureauScore !== undefined && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-600 mb-2">
                      🏛 Credit Bureau — {app.creditProfile.bureauProvider}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-600">
                        Normalised Score: <strong className={SCORE_COLOR(app.creditProfile.bureauScore)}>{app.creditProfile.bureauScore}/100</strong>
                      </span>
                      {app.creditProfile.bureauReference && (
                        <span className="text-slate-400 font-mono text-xs">Ref: {app.creditProfile.bureauReference}</span>
                      )}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Business Details */}
            <Section title="Business Profile">
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <Stat label="Registered Name" value={app.business.registeredName} />
                <Stat label="CAC Number" value={app.business.cacNumber} />
                <Stat label="Business Type" value={app.business.businessType} />
                <Stat label="Sector" value={app.business.sector} />
                <Stat label="State" value={app.business.state} />
                <Stat label="Years Operating" value={app.business.yearsInOperation ? `${app.business.yearsInOperation} years` : "—"} />
                <Stat label="Annual Turnover" value={app.business.annualTurnover ? `₦${Number(app.business.annualTurnover).toLocaleString()}` : "—"} />
                <Stat label="Commodities" value={app.business.commodities.map(c => c.replace(/_/g, " ")).join(", ") || "—"} />
                <Stat label="Export Markets" value={app.business.exportMarkets?.join(", ") || "None"} />
              </dl>
            </Section>

            {/* Facility Details */}
            <Section title="Facility Request">
              <dl className="grid grid-cols-3 gap-4 text-sm mb-4">
                <Stat label="Amount Requested" value={`₦${Number(app.amountRequested).toLocaleString()}`} />
                <Stat label="Tenor" value={`${app.tenor} months`} />
                <Stat label="System Type" value={app.systemType.replace(/_/g, " ")} />
                {app.systemSizeKwp && <Stat label="System Size" value={`${app.systemSizeKwp} kWp`} />}
                {app.projectAddress && <Stat label="Installation Address" value={app.projectAddress} />}
                <Stat label="Collateral Type" value={app.collateralType || "None"} />
                <Stat label="Collateral Value" value={app.collateralValue ? `₦${Number(app.collateralValue).toLocaleString()}` : "—"} />
              </dl>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">Purpose</p>
                <p className="text-sm text-slate-700">{app.purpose}</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">Project Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">{app.projectDescription}</p>
              </div>
            </Section>

            {/* Directors */}
            <Section title={`Directors (${app.business.directors.length})`}>
              <div className="space-y-3">
                {app.business.directors.map((dir) => (
                  <div key={dir.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{dir.firstName} {dir.lastName}</p>
                      <p className="text-xs text-slate-400">{dir.email} · {dir.phone} · {dir.percentOwned}% ownership</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${KYC_STYLES[dir.kycStatus] ?? "bg-slate-100 text-slate-600"}`}>
                      BVN {dir.kycStatus}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Analyst decision summary (if decided) */}
            {hasDecision && app.analystReview && (
              <Section title="Decision">
                <dl className="grid grid-cols-3 gap-4 text-sm mb-3">
                  <Stat label="Decision" value={app.analystReview.decision!} />
                  <Stat label="Amount Approved" value={app.analystReview.amountApproved ? `₦${Number(app.analystReview.amountApproved).toLocaleString()}` : "—"} />
                  <Stat label="Interest Rate" value={app.analystReview.interestRate ? `${app.analystReview.interestRate}% p.a.` : "—"} />
                </dl>
                {app.analystReview.notes && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 font-medium mb-1">Notes to Applicant</p>
                    <p className="text-sm text-slate-700">{app.analystReview.notes}</p>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-3">
                  Decided by {app.analystReview.analyst.firstName} {app.analystReview.analyst.lastName} ·{" "}
                  {app.analystReview.decidedAt ? new Date(app.analystReview.decidedAt).toLocaleDateString("en-NG") : "—"}
                </p>
              </Section>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <Section title="Uploaded Documents">
            {app.documents.length === 0 ? (
              <p className="text-sm text-slate-400">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-3">
                {app.documents.map((doc) => {
                  const isReviewing = reviewingDoc === doc.id;
                  const showReject = showRejectionBox[doc.id];
                  const statusStyles: Record<string, string> = {
                    APPROVED: "bg-green-50 border-green-200",
                    REJECTED: "bg-red-50 border-red-200",
                    PENDING: "bg-white border-slate-200",
                  };
                  const badgeStyles: Record<string, string> = {
                    APPROVED: "bg-green-100 text-green-700",
                    REJECTED: "bg-red-100 text-red-700",
                    PENDING: "bg-slate-100 text-slate-600",
                  };
                  return (
                    <div key={doc.id} className={`rounded-xl border p-4 ${statusStyles[doc.status] ?? "bg-white border-slate-200"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="text-slate-400 mt-0.5">📄</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-800">{doc.type.replace(/_/g, " ")}</p>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStyles[doc.status] ?? ""}`}>{doc.status}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{doc.fileName} · {new Date(doc.uploadedAt).toLocaleDateString("en-NG")}</p>
                            {doc.status === "REJECTED" && (doc as any).rejectionReason && (
                              <p className="text-xs text-red-600 mt-1">Reason: {(doc as any).rejectionReason}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <DocumentLink documentId={doc.id} fileName={doc.fileName} />
                          {doc.status !== "APPROVED" && (
                            <button
                              onClick={() => handleDocReview(doc.id, "APPROVED")}
                              disabled={isReviewing}
                              className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium"
                            >
                              {isReviewing ? "..." : "Accept"}
                            </button>
                          )}
                          {doc.status !== "REJECTED" && (
                            <button
                              onClick={() => {
                                if (!showReject) {
                                  setShowRejectionBox((p) => ({ ...p, [doc.id]: true }));
                                } else {
                                  handleDocReview(doc.id, "REJECTED");
                                }
                              }}
                              disabled={isReviewing}
                              className="text-xs bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium"
                            >
                              {isReviewing ? "..." : "Reject"}
                            </button>
                          )}
                        </div>
                      </div>
                      {showReject && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            rows={2}
                            placeholder="State the reason for rejection (sent to the customer)…"
                            value={rejectionInputs[doc.id] || ""}
                            onChange={(e) => setRejectionInputs((p) => ({ ...p, [doc.id]: e.target.value }))}
                            className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDocReview(doc.id, "REJECTED")}
                              disabled={isReviewing || !rejectionInputs[doc.id]?.trim()}
                              className="text-xs bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-medium"
                            >
                              {isReviewing ? "Sending..." : "Confirm Rejection & Notify Customer"}
                            </button>
                            <button
                              onClick={() => setShowRejectionBox((p) => ({ ...p, [doc.id]: false }))}
                              className="text-xs border border-slate-200 hover:border-slate-400 text-slate-600 px-3 py-1.5 rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* KYC Tab */}
        {activeTab === "kyc" && (
          <div className="space-y-4">
            {/* Individual KYC controls */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Run Individual Checks</h3>
              <div className="space-y-3">
                {/* CAC */}
                <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800">🏢 CAC — {app.business.cacNumber}</p>
                    <p className="text-xs text-slate-400">{app.business.registeredName}</p>
                  </div>
                  <button
                    onClick={runCac}
                    disabled={runningCac}
                    className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {runningCac ? <><Spinner /> Running...</> : "Verify CAC"}
                  </button>
                </div>
                {/* BVN per director */}
                {app.business.directors.map((dir) => (
                  <div key={dir.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">👤 {dir.firstName} {dir.lastName}</p>
                      <p className="text-xs text-slate-400">BVN: {dir.bvn} · {dir.percentOwned}% ownership</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${KYC_STYLES[dir.kycStatus] ?? "bg-slate-100 text-slate-600"}`}>
                        {dir.kycStatus}
                      </span>
                      <button
                        onClick={() => runBvn(dir.id, dir.bvn, (dir as any).dateOfBirth || "")}
                        disabled={!!runningBvn[dir.id]}
                        className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {runningBvn[dir.id] ? <><Spinner /> Running...</> : "Verify BVN"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Results */}
            {app.kycChecks.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-400">No checks run yet. Use the controls above to verify each check individually.</p>
              </div>
            ) : (
              app.kycChecks.map((check) => (
                <div key={check.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{check.checkType === "CAC" ? "🏢" : "👤"}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {check.checkType === "CAC" ? "CAC Company Verification" : `BVN Verification`}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          via {check.provider} · {new Date(check.checkedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {check.checkType === "CAC" && (
                        <button
                          onClick={runCac}
                          disabled={runningCac}
                          className="flex items-center gap-1.5 text-xs border border-slate-200 hover:border-slate-400 disabled:opacity-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {runningCac ? <><Spinner /> Running...</> : "↺ Re-verify"}
                        </button>
                      )}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${KYC_STYLES[check.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {check.status}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {check.notes && (
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                      <p className="text-xs text-slate-500">{check.notes}</p>
                    </div>
                  )}

                  {/* Dojah response data */}
                  {check.rawResponse && (
                    <div className="px-5 py-4">
                      {check.checkType === "CAC" ? (
                        <CACResponseView data={check.rawResponse} />
                      ) : (
                        <BVNResponseView data={check.rawResponse} />
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Decision Tab */}
        {activeTab === "decision" && (
          <Section title={hasDecision ? "Decision (Submitted)" : "Submit Decision"}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Decision *</label>
                <div className="flex gap-3">
                  {["APPROVED", "DECLINED", "MORE_INFO_REQUIRED"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={hasDecision}
                      onClick={() => setDecision((f) => ({ ...f, decision: d }))}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                        decision.decision === d
                          ? d === "APPROVED" ? "border-green-500 bg-green-50 text-green-700"
                          : d === "DECLINED" ? "border-red-500 bg-red-50 text-red-700"
                          : "border-orange-400 bg-orange-50 text-orange-700"
                          : "border-slate-200 text-slate-400 hover:border-slate-400"
                      } disabled:cursor-not-allowed`}
                    >
                      {d.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>

              {decision.decision === "APPROVED" && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount Approved (₦)</label>
                    <input
                      type="number" value={decision.amountApproved} disabled={hasDecision}
                      onChange={(e) => setDecision((f) => ({ ...f, amountApproved: e.target.value }))}
                      className={inp} placeholder={app.amountRequested.toString()}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Tenor Approved (months)</label>
                    <input
                      type="number" value={decision.tenorApproved} disabled={hasDecision}
                      onChange={(e) => setDecision((f) => ({ ...f, tenorApproved: e.target.value }))}
                      className={inp} placeholder={app.tenor.toString()}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Interest Rate (% p.a.)</label>
                    <input
                      type="number" step="0.1" value={decision.interestRate} disabled={hasDecision}
                      onChange={(e) => setDecision((f) => ({ ...f, interestRate: e.target.value }))}
                      className={inp} placeholder="18"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Conditions <span className="text-slate-400 font-normal">(one per line)</span></label>
                <textarea
                  rows={3} value={decision.conditions} disabled={hasDecision}
                  onChange={(e) => setDecision((f) => ({ ...f, conditions: e.target.value }))}
                  className={`${inp} resize-none`}
                  placeholder="Provide audited accounts within 30 days&#10;Domicile sales proceeds with the bank"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes to Applicant</label>
                <textarea
                  rows={3} value={decision.notes} disabled={hasDecision}
                  onChange={(e) => setDecision((f) => ({ ...f, notes: e.target.value }))}
                  className={`${inp} resize-none`}
                  placeholder="Message that will be visible to the applicant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Internal Notes <span className="text-slate-400 font-normal">(not visible to applicant)</span></label>
                <textarea
                  rows={2} value={decision.internalNotes} disabled={hasDecision}
                  onChange={(e) => setDecision((f) => ({ ...f, internalNotes: e.target.value }))}
                  className={`${inp} resize-none`}
                  placeholder="Internal observations for the credit file"
                />
              </div>

              {!hasDecision && (
                <button
                  onClick={submitDecision}
                  disabled={submittingDecision || !decision.decision}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
                >
                  {submittingDecision && <Spinner />}
                  {submittingDecision ? "Submitting..." : "Submit Decision →"}
                </button>
              )}
            </div>
          </Section>
        )}
      </div>
    </AnalystShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 font-medium">{label}</dt>
      <dd className="text-slate-800 font-medium mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

const inp = "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white disabled:bg-slate-50 disabled:text-slate-500";

// ─── Dojah CAC response display ───────────────────────────────────────────────
function CACResponseView({ data }: { data: Record<string, any> }) {
  const entity = data?.entity ?? data;

  const fields = [
    { label: "Company Name",       value: entity?.company_name ?? entity?.companyName },
    { label: "RC Number",          value: entity?.rc_number ?? entity?.rcNumber },
    { label: "Company Type",       value: entity?.company_type ?? entity?.type },
    { label: "Registration Date",  value: entity?.registration_date ?? entity?.registrationDate },
    { label: "Status",             value: entity?.company_status ?? entity?.status },
    { label: "Address",            value: entity?.address },
    { label: "Email",              value: entity?.email },
    { label: "Phone",              value: entity?.phone },
    { label: "LGA",                value: entity?.lga },
    { label: "State",              value: entity?.state },
  ].filter((f) => f.value);

  const directors: any[] = entity?.directors ?? entity?.affiliates ?? [];

  if (fields.length === 0 && directors.length === 0) {
    return <p className="text-xs text-slate-400 italic">No structured data available from provider.</p>;
  }

  return (
    <div className="space-y-4">
      {fields.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-slate-400 font-medium">{label}</dt>
              <dd className="text-sm text-slate-800 font-medium mt-0.5">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {directors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Registered Directors / Affiliates</p>
          <div className="space-y-1.5">
            {directors.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-slate-400">👤</span>
                <span>{d.name ?? `${d.firstname ?? ""} ${d.lastname ?? ""}`.trim()}</span>
                {d.status && <span className="ml-auto text-xs text-slate-400">{d.status}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dojah BVN response display ───────────────────────────────────────────────
function BVNResponseView({ data }: { data: Record<string, any> }) {
  const entity = data?.entity ?? data;

  const fields = [
    { label: "Full Name",          value: entity?.full_name ?? (`${entity?.first_name ?? ""} ${entity?.last_name ?? ""}`.trim() || undefined) },
    { label: "BVN",                value: entity?.bvn },
    { label: "Date of Birth",      value: entity?.date_of_birth ?? entity?.dateOfBirth },
    { label: "Phone",              value: entity?.phone_number ?? entity?.phone },
    { label: "Gender",             value: entity?.gender },
    { label: "Nationality",        value: entity?.nationality },
    { label: "State of Origin",    value: entity?.state_of_origin ?? entity?.stateOfOrigin },
    { label: "LGA of Origin",      value: entity?.lga_of_origin },
    { label: "Enrolment Bank",     value: entity?.enrollment_bank ?? entity?.enrollmentBank },
    { label: "Watch Listed",       value: entity?.watch_listed !== undefined ? (entity.watch_listed ? "Yes" : "No") : undefined },
  ].filter((f) => f.value);

  const photo: string | undefined = entity?.image ?? entity?.photo ?? entity?.base64Image;

  if (fields.length === 0) {
    return <p className="text-xs text-slate-400 italic">No structured data available from provider.</p>;
  }

  return (
    <div className="flex gap-6">
      {photo && (
        <div className="flex-shrink-0">
          <img
            src={`data:image/jpeg;base64,${photo}`}
            alt="BVN photo"
            className="w-20 h-24 object-cover rounded-lg border border-slate-200"
          />
          <p className="text-xs text-slate-400 text-center mt-1">BVN photo</p>
        </div>
      )}
      <dl className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs text-slate-400 font-medium">{label}</dt>
            <dd className="text-sm text-slate-800 font-medium mt-0.5">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
