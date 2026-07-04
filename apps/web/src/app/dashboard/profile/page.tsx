"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/shared/spinner";
import { parseApiError } from "@/lib/errors";

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
  "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba",
  "Yobe","Zamfara",
];

interface Business {
  id: string;
  registeredName: string;
  tradingName?: string;
  cacNumber: string;
  taxId?: string;
  dateIncorporated?: string;
  businessType: string;
  sector: string;
  address: string;
  city: string;
  state: string;
  website?: string;
  yearsInOperation?: number;
  annualTurnover?: number;
  monthlyEnergyBill?: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    tradingName: "", taxId: "", address: "", city: "", state: "Lagos",
    website: "", yearsInOperation: "", annualTurnover: "", monthlyEnergyBill: "",
  });

  useEffect(() => {
    api.get("/api/business")
      .then((r) => {
        const b: Business = r.data.data;
        setBusiness(b);
        setForm({
          tradingName: b.tradingName || "",
          taxId: b.taxId || "",
          address: b.address || "",
          city: b.city || "",
          state: b.state || "Lagos",
          website: b.website || "",
          yearsInOperation: b.yearsInOperation?.toString() || "",
          annualTurnover: b.annualTurnover?.toString() || "",
          monthlyEnergyBill: b.monthlyEnergyBill?.toString() || "",
        });
      })
      .catch(() => setError("Could not load business profile."))
      .finally(() => setLoading(false));
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const payload = {
        registeredName: business!.registeredName,
        cacNumber: business!.cacNumber,
        businessType: business!.businessType,
        sector: business!.sector,
        dateIncorporated: business!.dateIncorporated,
        ...form,
        yearsInOperation: form.yearsInOperation ? parseInt(form.yearsInOperation) : undefined,
        annualTurnover: form.annualTurnover ? parseFloat(form.annualTurnover) : undefined,
        monthlyEnergyBill: form.monthlyEnergyBill ? parseFloat(form.monthlyEnergyBill) : undefined,
      };
      const { data } = await api.post("/api/business", payload);
      setBusiness(data.data);
      setSuccess("Profile updated successfully.");
      setEditing(false);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
      <Spinner className="w-5 h-5" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")} className="text-slate-400 hover:text-slate-600 transition-colors">←</button>
            <div>
              <h1 className="font-display font-bold text-slate-900">Business Profile</h1>
              <p className="text-slate-400 text-xs">{business?.registeredName}</p>
            </div>
          </div>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all"
              style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}>
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setError(""); }}
                className="text-sm font-medium px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="text-sm font-semibold px-4 py-2 rounded-xl text-white flex items-center gap-2 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #f5a623, #e0850d)" }}>
                {saving && <Spinner />}
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
        {success && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", color: "#15803d" }}>
            ✓ {success}
          </div>
        )}

        {/* Registration Details — read only */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-slate-900">Registration Details</h2>
            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">Read-only</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Contact support to make changes to these fields.</p>
          <div className="grid grid-cols-2 gap-5">
            <ReadField label="Registered Name" value={business?.registeredName} />
            <ReadField label="CAC Number" value={business?.cacNumber} mono />
            <ReadField label="Business Type" value={business?.businessType} />
            <ReadField label="Sector" value={business?.sector} />
            {business?.dateIncorporated && (
              <ReadField label="Date of Incorporation"
                value={new Date(business.dateIncorporated).toLocaleDateString("en-NG")} />
            )}
          </div>
        </section>

        {/* Contact Information */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h2 className="font-display font-semibold text-slate-900 mb-5">Contact Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <EditField label="Trading Name" value={form.tradingName || "—"} editing={editing}>
                <input value={form.tradingName} onChange={set("tradingName")} className={inp} placeholder="If different from registered name" />
              </EditField>
              <EditField label="Tax ID (TIN)" value={form.taxId || "—"} editing={editing}>
                <input value={form.taxId} onChange={set("taxId")} className={inp} placeholder="12345678-0001" />
              </EditField>
            </div>
            <EditField label="Registered Address" value={form.address} editing={editing}>
              <input value={form.address} onChange={set("address")} className={inp} placeholder="12 Commerce Road" />
            </EditField>
            <div className="grid grid-cols-2 gap-4">
              <EditField label="City" value={form.city} editing={editing}>
                <input value={form.city} onChange={set("city")} className={inp} placeholder="Lagos" />
              </EditField>
              <EditField label="State" value={form.state} editing={editing}>
                <select value={form.state} onChange={set("state")} className={inp}>
                  {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </EditField>
            </div>
            <EditField label="Website" value={form.website || "—"} editing={editing}>
              <input type="url" value={form.website} onChange={set("website")} className={inp} placeholder="https://yourcompany.com" />
            </EditField>
          </div>
        </section>

        {/* Financial & Energy Profile */}
        <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-start gap-3 mb-5">
            <div>
              <h2 className="font-display font-semibold text-slate-900">Financial & Energy Profile</h2>
              <p className="text-xs text-slate-400 mt-0.5">Used to calculate your loan eligibility and solar savings</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <EditField label="Years in Operation" value={business?.yearsInOperation?.toString() || "—"} editing={editing}>
                <input type="number" min="0" value={form.yearsInOperation} onChange={set("yearsInOperation")} className={inp} placeholder="5" />
              </EditField>
              <EditField label="Annual Turnover (₦)"
                value={business?.annualTurnover ? `₦${Number(business.annualTurnover).toLocaleString()}` : "—"}
                editing={editing}>
                <input type="number" min="0" value={form.annualTurnover} onChange={set("annualTurnover")} className={inp} placeholder="50,000,000" />
              </EditField>
            </div>
            <EditField label="Monthly Electricity / Generator Cost (₦)"
              value={business?.monthlyEnergyBill ? `₦${Number(business.monthlyEnergyBill).toLocaleString()}` : "—"}
              editing={editing}>
              <input type="number" min="0" value={form.monthlyEnergyBill} onChange={set("monthlyEnergyBill")} className={inp} placeholder="800,000" />
            </EditField>
          </div>
        </section>
      </main>
    </div>
  );
}

function ReadField({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
      <p className={`text-sm text-slate-800 ${mono ? "font-mono" : "font-medium"}`}>{value || "—"}</p>
    </div>
  );
}

function EditField({ label, value, editing, children }: { label: string; value: string; editing: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {editing ? children : <p className="text-sm text-slate-700 py-2.5 border-b border-slate-100">{value || "—"}</p>}
    </div>
  );
}

const inp = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-slate-50 transition-colors";
