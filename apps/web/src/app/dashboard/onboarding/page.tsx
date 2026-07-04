"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError, parseFieldErrors } from "@/lib/errors";

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
  "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba",
  "Yobe","Zamfara",
];

const STEPS = [
  { label: "Business Details", icon: "🏢" },
  { label: "Energy & Financials", icon: "⚡" },
  { label: "Directors / Guarantors", icon: "👤" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [business, setBusiness] = useState({
    registeredName: "", tradingName: "", cacNumber: "", taxId: "",
    dateIncorporated: "", businessType: "Limited", sector: "Commercial",
    address: "", city: "", state: "Lagos", website: "",
    yearsInOperation: "", annualTurnover: "", monthlyEnergyBill: "",
  });

  const [directors, setDirectors] = useState([{
    firstName: "", lastName: "", dateOfBirth: "", bvn: "", nin: "", phone: "",
    email: "", percentOwned: "", isSignatory: true,
  }]);

  const setBiz = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setBusiness((b) => ({ ...b, [field]: e.target.value }));

  const setDir = (i: number, field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDirectors((dirs) => dirs.map((d, idx) => (idx === i ? { ...d, [field]: e.target.value } : d)));

  const addDirector = () =>
    setDirectors((d) => [...d, { firstName: "", lastName: "", dateOfBirth: "", bvn: "", nin: "", phone: "", email: "", percentOwned: "", isSignatory: false }]);

  const buildPayload = () => ({
    ...business,
    yearsInOperation: business.yearsInOperation ? parseInt(business.yearsInOperation) : undefined,
    annualTurnover: business.annualTurnover ? parseFloat(business.annualTurnover) : undefined,
    monthlyEnergyBill: business.monthlyEnergyBill ? parseFloat(business.monthlyEnergyBill) : undefined,
  });

  const saveBusinessProfile = async () => {
    setLoading(true); setError(""); setFieldErrors({});
    try { await api.post("/api/business", buildPayload()); setStep(1); }
    catch (err: any) { setFieldErrors(parseFieldErrors(err)); setError(parseApiError(err)); }
    finally { setLoading(false); }
  };

  const saveEnergyProfile = async () => {
    setLoading(true); setError("");
    try { await api.post("/api/business", buildPayload()); setStep(2); }
    catch (err: any) { setError(parseApiError(err)); }
    finally { setLoading(false); }
  };

  const saveDirectors = async () => {
    setLoading(true); setError("");
    try {
      for (let i = 0; i < directors.length; i++) {
        const dir = directors[i];
        if (dir.bvn.length !== 11) { setError(`Director ${i + 1}: BVN must be exactly 11 digits.`); setLoading(false); return; }
        if (!dir.firstName || !dir.lastName || !dir.dateOfBirth || !dir.phone || !dir.email || !dir.percentOwned) {
          setError(`Director ${i + 1}: Please fill in all required fields.`); setLoading(false); return;
        }
        await api.post("/api/business/directors", { ...dir, percentOwned: parseFloat(dir.percentOwned) });
      }
      router.push("/dashboard");
    } catch (err: any) { setError(parseApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
              style={{ background: "linear-gradient(135deg, #f5a623, #e8920f)" }}>☀</span>
            <span className="font-display font-bold text-slate-900">SolarCredit</span>
          </div>
          <span className="text-slate-400 text-sm">Setting up your profile</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-0.5 bg-slate-100">
        <div className="h-0.5 transition-all duration-500"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "linear-gradient(90deg, #f5a623, #e0850d)" }} />
      </div>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step ? "text-white" : i === step ? "text-white" : "text-slate-400 bg-slate-100"
                }`}
                  style={i <= step ? { background: i === step ? "linear-gradient(135deg, #f5a623, #e0850d)" : "#16a34a" } : {}}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${i === step ? "text-slate-900" : i < step ? "text-green-600" : "text-slate-400"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-8 h-px mx-1" style={{ background: i < step ? "#16a34a" : "#e2e8f0" }} />
              )}
            </div>
          ))}
        </div>

        {/* Step heading */}
        <div className="mb-7">
          <h1 className="font-display text-xl font-bold text-slate-900">
            {STEPS[step].icon} {STEPS[step].label}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Step {step + 1} of {STEPS.length}</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* ── Step 0: Business Details ── */}
        {step === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-7 shadow-sm space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Registered Company Name *" error={fieldErrors.registeredName}>
                <input value={business.registeredName} onChange={setBiz("registeredName")} required
                  className={fieldErrors.registeredName ? inputError : input} placeholder="ABC Solar Ltd" />
              </Field>
              <Field label="Trading Name">
                <input value={business.tradingName} onChange={setBiz("tradingName")} className={input} placeholder="If different" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CAC Number *" error={fieldErrors.cacNumber}>
                <input value={business.cacNumber} onChange={setBiz("cacNumber")} required
                  className={fieldErrors.cacNumber ? inputError : input} placeholder="RC123456" />
              </Field>
              <Field label="Tax ID (TIN)">
                <input value={business.taxId} onChange={setBiz("taxId")} className={input} placeholder="12345678-0001" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Business Type *">
                <select value={business.businessType} onChange={setBiz("businessType")} className={input}>
                  <option>Limited</option><option>Enterprise</option>
                  <option>Partnership</option><option>Individual</option>
                </select>
              </Field>
              <Field label="Sector *">
                <select value={business.sector} onChange={setBiz("sector")} className={input}>
                  <option>Commercial</option><option>Industrial</option><option>Healthcare</option>
                  <option>Education</option><option>Agro-Processing</option><option>Residential</option><option>Other</option>
                </select>
              </Field>
            </div>
            <Field label="Date of Incorporation">
              <input type="date" value={business.dateIncorporated} onChange={setBiz("dateIncorporated")} className={input} />
            </Field>
            <Field label="Registered Address *" error={fieldErrors.address}>
              <input value={business.address} onChange={setBiz("address")} required
                className={fieldErrors.address ? inputError : input} placeholder="12 Commerce Road, Victoria Island" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City *" error={fieldErrors.city}>
                <input value={business.city} onChange={setBiz("city")} required
                  className={fieldErrors.city ? inputError : input} placeholder="Lagos" />
              </Field>
              <Field label="State *">
                <select value={business.state} onChange={setBiz("state")} className={input}>
                  {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Website">
              <input type="url" value={business.website} onChange={setBiz("website")} className={input} placeholder="https://yourcompany.com" />
            </Field>
            <button onClick={saveBusinessProfile} disabled={loading} className={btn}
              style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}>
              {loading && <Spinner />} {loading ? "Saving…" : "Continue →"}
            </button>
          </div>
        )}

        {/* ── Step 1: Energy & Financial Profile ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="rounded-xl px-5 py-4 border"
              style={{ background: "rgba(245,166,35,0.06)", borderColor: "rgba(245,166,35,0.2)" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "#b45309" }}>💡 Why we ask this</p>
              <p className="text-xs text-amber-700">Your energy spend and financial profile help us determine the right loan size and how much you stand to save with solar.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-7 shadow-sm space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Years in Operation" hint="How long has the business been running?">
                  <input type="number" min="0" value={business.yearsInOperation} onChange={setBiz("yearsInOperation")} className={input} placeholder="5" />
                </Field>
                <Field label="Annual Turnover (₦)" hint="Approximate annual revenue">
                  <input type="number" min="0" value={business.annualTurnover} onChange={setBiz("annualTurnover")} className={input} placeholder="50,000,000" />
                </Field>
              </div>
              <Field label="Monthly Electricity / Generator Cost (₦) *" hint="Average monthly spend on DISCO bills + diesel combined — drives your loan sizing">
                <input type="number" min="0" value={business.monthlyEnergyBill} onChange={setBiz("monthlyEnergyBill")} className={input} placeholder="800,000" />
              </Field>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className={btnOutline}>← Back</button>
              <button onClick={saveEnergyProfile} disabled={loading} className={btn}
                style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}>
                {loading && <Spinner />} {loading ? "Saving…" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Directors / Guarantors ── */}
        {step === 2 && (
          <div className="space-y-5">
            {directors.map((dir, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-7 shadow-sm">
                <h3 className="font-display font-semibold text-slate-900 mb-5">Director / Guarantor {i + 1}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="First Name *">
                      <input value={dir.firstName} onChange={setDir(i, "firstName")} required className={input} placeholder="Chidi" />
                    </Field>
                    <Field label="Last Name *">
                      <input value={dir.lastName} onChange={setDir(i, "lastName")} required className={input} placeholder="Okonkwo" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Date of Birth *" hint="Used for BVN verification">
                      <input type="date" value={dir.dateOfBirth} onChange={setDir(i, "dateOfBirth")} required className={input} />
                    </Field>
                    <Field label="NIN">
                      <input value={dir.nin} onChange={setDir(i, "nin")} className={input} placeholder="Optional" />
                    </Field>
                  </div>
                  <Field label="BVN *" hint="11-digit Bank Verification Number">
                    <input value={dir.bvn} onChange={setDir(i, "bvn")} maxLength={11} required className={input} placeholder="12345678901" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Phone *">
                      <input value={dir.phone} onChange={setDir(i, "phone")} required className={input} placeholder="08012345678" />
                    </Field>
                    <Field label="Email *">
                      <input type="email" value={dir.email} onChange={setDir(i, "email")} required className={input} placeholder="director@co.com" />
                    </Field>
                  </div>
                  <Field label="% Ownership / Guarantee *">
                    <input type="number" min="0" max="100" value={dir.percentOwned} onChange={setDir(i, "percentOwned")} required className={input} placeholder="51" />
                  </Field>
                </div>
              </div>
            ))}
            <button type="button" onClick={addDirector} className={btnOutline}>
              + Add another director / guarantor
            </button>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className={btnOutline}>← Back</button>
              <button onClick={saveDirectors} disabled={loading} className={btn}
                style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}>
                {loading && <Spinner />} {loading ? "Saving…" : "Complete Profile →"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const input = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-slate-50 transition-colors";
const inputError = "w-full border border-red-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent bg-white";
const btn = "flex items-center gap-2 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md";
const btnOutline = "border border-slate-200 hover:border-slate-300 text-slate-600 font-medium px-6 py-2.5 rounded-xl transition-colors";

// Inject gradient into btn dynamically via inline style — defined as class stub above
// We use style prop on the button elements directly for the gradient
