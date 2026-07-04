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
    tradingName: "",
    taxId: "",
    address: "",
    city: "",
    state: "Lagos",
    website: "",
    yearsInOperation: "",
    annualTurnover: "",
    monthlyEnergyBill: "",
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

  const set = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
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

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-slate-400 hover:text-slate-600">←</button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Business Profile</h1>
            <p className="text-slate-500 text-sm">{business?.registeredName}</p>
          </div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-sm font-medium bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-lg">
            Edit Profile
          </button>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">{success}</div>}

        {/* Read-only: Registration Details */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Registration Details</h2>
          <p className="text-xs text-slate-400 mb-4">These fields are locked. Contact support to make changes.</p>
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Registered Name" value={business?.registeredName} />
            <ReadField label="CAC Number" value={business?.cacNumber} />
            <ReadField label="Business Type" value={business?.businessType} />
            <ReadField label="Sector" value={business?.sector} />
            {business?.dateIncorporated && (
              <ReadField label="Date of Incorporation" value={new Date(business.dateIncorporated).toLocaleDateString("en-NG")} />
            )}
          </div>
        </section>

        {/* Editable: Contact Info */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Contact Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <EditableField label="Trading Name" value={form.tradingName || "—"} editing={editing}>
                <input value={form.tradingName} onChange={set("tradingName")} className={input} placeholder="If different from registered name" />
              </EditableField>
              <EditableField label="Tax ID (TIN)" value={form.taxId || "—"} editing={editing}>
                <input value={form.taxId} onChange={set("taxId")} className={input} placeholder="12345678-0001" />
              </EditableField>
            </div>
            <EditableField label="Registered Address" value={form.address} editing={editing}>
              <input value={form.address} onChange={set("address")} className={input} placeholder="12 Commerce Road" />
            </EditableField>
            <div className="grid grid-cols-2 gap-4">
              <EditableField label="City" value={form.city} editing={editing}>
                <input value={form.city} onChange={set("city")} className={input} placeholder="Lagos" />
              </EditableField>
              <EditableField label="State" value={form.state} editing={editing}>
                <select value={form.state} onChange={set("state")} className={input}>
                  {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </EditableField>
            </div>
            <EditableField label="Website" value={form.website || "—"} editing={editing}>
              <input type="url" value={form.website} onChange={set("website")} className={input} placeholder="https://yourcompany.com" />
            </EditableField>
          </div>
        </section>

        {/* Editable: Financial & Energy Profile */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Financial & Energy Profile</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <EditableField label="Years in Operation" value={business?.yearsInOperation?.toString() || "—"} editing={editing}>
                <input type="number" min="0" value={form.yearsInOperation} onChange={set("yearsInOperation")} className={input} placeholder="5" />
              </EditableField>
              <EditableField label="Annual Turnover (₦)" value={business?.annualTurnover ? `₦${Number(business.annualTurnover).toLocaleString()}` : "—"} editing={editing}>
                <input type="number" min="0" value={form.annualTurnover} onChange={set("annualTurnover")} className={input} placeholder="50000000" />
              </EditableField>
            </div>
            <EditableField label="Monthly Electricity / Generator Cost (₦)" value={business?.monthlyEnergyBill ? `₦${Number(business.monthlyEnergyBill).toLocaleString()}` : "—"} editing={editing}>
              <input type="number" min="0" value={form.monthlyEnergyBill} onChange={set("monthlyEnergyBill")} className={input} placeholder="800000" />
            </EditableField>
          </div>
        </section>

        {editing && (
          <div className="flex gap-3 pb-8">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg">
              {saving && <Spinner />}{saving ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={() => { setEditing(false); setError(""); }} className="border border-slate-200 hover:border-slate-400 text-slate-600 font-medium px-6 py-2.5 rounded-lg">
              Cancel
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-slate-800">{value || "—"}</p>
    </div>
  );
}

function EditableField({ label, value, editing, children }: { label: string; value: string; editing: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {editing ? children : <p className="text-sm text-slate-800 py-2">{value || "—"}</p>}
    </div>
  );
}

const input = "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white";
