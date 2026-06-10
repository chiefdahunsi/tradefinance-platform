import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center px-6">
        <div className="mb-6">
          <span className="inline-block bg-green-500/20 text-green-400 text-sm font-medium px-3 py-1 rounded-full border border-green-500/30">
            Nigeria Commodity Trade Finance
          </span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
          Fast funding for commodity traders
        </h1>
        <p className="text-slate-400 text-lg mb-10">
          Apply for a trade finance facility in minutes. Complete KYC, upload
          your documents, and get a decision from our credit team.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-up"
            className="bg-green-600 hover:bg-green-500 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Apply Now
          </Link>
          <Link
            href="/sign-in"
            className="border border-slate-600 hover:border-slate-400 text-slate-300 font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-3 gap-6 text-center">
          {[
            { label: "KYC Verified", value: "< 24hrs" },
            { label: "Credit Decision", value: "48–72hrs" },
            { label: "Max Facility", value: "₦1Bn" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-slate-800/50 rounded-xl p-5 border border-slate-700"
            >
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-slate-400 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
