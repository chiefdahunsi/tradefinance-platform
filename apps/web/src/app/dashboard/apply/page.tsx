"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError, parseFieldErrors } from "@/lib/errors";

const COMMODITIES = [
  "COCOA","CASHEW","SESAME","SOYBEAN","PALM_OIL",
  "GROUNDNUT","COTTON","GINGER","RUBBER","OTHER",
];

export default function ApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const invoiceRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    amountRequested: "",
    tenor: "3",
    purpose: "",
    commodityType: "COCOA",
    tradeDescription: "",
    collateralType: "",
    collateralValue: "",
    collateralDetails: "",
  });

  const set = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      const payload = {
        ...form,
        amountRequested: parseFloat(form.amountRequested),
        tenor: parseInt(form.tenor),
        collateralValue: form.collateralValue ? parseFloat(form.collateralValue) : undefined,
      };
      const { data } = await api.post("/api/applications", payload);
      const applicationId = data.data.id;

      // Upload invoice if provided
      if (invoiceFile) {
        const formData = new FormData();
        formData.append("file", invoiceFile);
        formData.append("documentType", "INVOICE");
        // Don't set Content-Type manually — axios sets it with the correct boundary for multipart
        await api.post(`/api/documents/${applicationId}`, formData);
      }

      router.push(`/dashboard/applications/${applicationId}`);
    } catch (err: any) {
      setFieldErrors(parseFieldErrors(err));
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600">
          ←
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900">New Facility Application</h1>
          <p className="text-slate-500 text-sm">Trade finance facility request</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Facility details */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-5">Facility Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount Requested (₦) *" error={fieldErrors.amountRequested}>
                  <input
                    type="number" min="100000" required
                    value={form.amountRequested} onChange={set("amountRequested")}
                    className={fieldErrors.amountRequested ? inputError : input}
                    placeholder="5,000,000"
                  />
                </Field>
                <Field label="Tenor (months) *" error={fieldErrors.tenor}>
                  <select value={form.tenor} onChange={set("tenor")} className={input}>
                    {[1,2,3,4,5,6,9,12,18,24].map((t) => (
                      <option key={t} value={t}>{t} {t === 1 ? "month" : "months"}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Commodity Type *" error={fieldErrors.commodityType}>
                <select value={form.commodityType} onChange={set("commodityType")} className={input}>
                  {COMMODITIES.map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </Field>
              <Field label="Purpose of Facility *" error={fieldErrors.purpose}>
                <input
                  required value={form.purpose} onChange={(e) => { set("purpose")(e); setFieldErrors(f => ({ ...f, purpose: "" })); }}
                  className={fieldErrors.purpose ? inputError : input}
                  placeholder="e.g. Purchase of 200MT cocoa beans for export"
                />
              </Field>
              <Field label="Trade Description *" hint="Describe the trade cycle — what you're buying, from whom, selling to whom, and expected timeline" error={fieldErrors.tradeDescription}>
                <textarea
                  required rows={4} value={form.tradeDescription}
                  onChange={(e) => { set("tradeDescription")(e); setFieldErrors(f => ({ ...f, tradeDescription: "" })); }}
                  className={`${fieldErrors.tradeDescription ? inputError : input} resize-none`}
                  placeholder="We purchase cocoa beans from aggregators in Ondo State and export to buyers in Amsterdam under a confirmed LC. Trade cycle is 60–90 days."
                />
              </Field>
            </div>
          </section>

          {/* Invoice Upload */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Commercial Invoice</h2>
            <p className="text-slate-500 text-sm mb-5">
              Optional — upload now or later from the application page. PDF, JPG or PNG · Max 10MB.
            </p>
            <input
              ref={invoiceRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
            />
            {invoiceFile ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <span>📄</span>
                  <span className="font-medium">{invoiceFile.name}</span>
                  <span className="text-green-600">({(invoiceFile.size / 1024).toFixed(0)} KB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setInvoiceFile(null); if (invoiceRef.current) invoiceRef.current.value = ""; }}
                  className="text-green-600 hover:text-red-500 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => invoiceRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 hover:border-green-400 rounded-lg py-6 text-sm text-slate-400 hover:text-green-600 transition-colors"
              >
                Click to upload invoice
              </button>
            )}
          </section>

          {/* Collateral */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Collateral</h2>
            <p className="text-slate-500 text-sm mb-5">Optional but improves your credit score significantly</p>
            <div className="space-y-4">
              <Field label="Collateral Type">
                <select value={form.collateralType} onChange={set("collateralType")} className={input}>
                  <option value="">None / Not applicable</option>
                  <option>Real Estate</option>
                  <option>Warehouse Receipt</option>
                  <option>Letter of Credit</option>
                  <option>Equipment</option>
                  <option>Stock / Inventory</option>
                  <option>Domiciliation of Sales</option>
                </select>
              </Field>
              {form.collateralType && (
                <>
                  <Field label="Estimated Value (₦)">
                    <input
                      type="number" min="0" value={form.collateralValue} onChange={set("collateralValue")}
                      className={input} placeholder="10,000,000"
                    />
                  </Field>
                  <Field label="Collateral Details">
                    <textarea
                      rows={3} value={form.collateralDetails} onChange={set("collateralDetails")}
                      className={`${input} resize-none`}
                      placeholder="Describe the collateral — location, condition, ownership details"
                    />
                  </Field>
                </>
              )}
            </div>
          </section>

          <button type="submit" disabled={loading} className={btn}>
            {loading && <Spinner />}
            {loading ? "Creating..." : "Create Application & Upload Documents →"}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const input = "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white";
const inputError = "w-full border border-red-400 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent bg-white";
const btn = "flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors";
