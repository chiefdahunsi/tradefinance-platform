import { LoanApplication, Business, Director, Document, KYCCheck } from "@prisma/client";
import { aggregateDirectorBureauScore, IS_FIRSTCENTRAL_CONFIGURED, scoreRating } from "./firstcentral";

type ApplicationWithRelations = LoanApplication & {
  business: Business & { directors: Director[] };
  documents: Document[];
  kycChecks: KYCCheck[];
};

export async function generateCreditProfile(app: ApplicationWithRelations) {
  const kycScore = scoreKYC(app);
  const financialScore = scoreFinancials(app);
  const projectViabilityScore = scoreProjectViability(app);
  const collateralScore = scoreCollateral(app);

  // ── Bureau lookup (FirstCentral) ──────────────────────────────────────────
  let bureauScore: number | null = null;
  let bureauProvider: string | null = null;
  let bureauReference: string | null = null;
  let bureauRawData: Record<string, unknown> | null = null;
  let bureauRating: string | null = null;

  if (IS_FIRSTCENTRAL_CONFIGURED) {
    try {
      const bureauResult = await aggregateDirectorBureauScore(
        app.business.directors.map((d) => ({
          bvn: (d as any).bvn ?? null,
          firstName: d.firstName,
          lastName: d.lastName,
        }))
      );
      if (bureauResult.aggregatedScore !== null) {
        bureauScore = bureauResult.aggregatedScore;
        bureauProvider = "FirstCentral";
        bureauReference = bureauResult.reference;
        bureauRawData = bureauResult.rawData;
        bureauRating = scoreRating(Math.round((bureauScore / 100) * 850));
      }
    } catch (err) {
      console.error("[scoring] Bureau lookup failed, continuing without it:", err);
    }
  }

  // ── Weighted total ────────────────────────────────────────────────────────
  let totalScore: number;
  if (bureauScore !== null) {
    totalScore = Math.round(
      kycScore               * 0.25 +
      financialScore         * 0.25 +
      projectViabilityScore  * 0.20 +
      collateralScore        * 0.10 +
      bureauScore            * 0.20
    );
  } else {
    totalScore = Math.round(
      kycScore               * 0.30 +
      financialScore         * 0.30 +
      projectViabilityScore  * 0.25 +
      collateralScore        * 0.15
    );
  }

  const scoreGrade = getGrade(totalScore);
  const recommendation = totalScore >= 60 ? "APPROVE" : totalScore >= 45 ? "REVIEW" : "DECLINE";

  const strengths: string[] = [];
  const risks: string[] = [];
  const conditions: string[] = [];

  if (kycScore >= 80) strengths.push("All KYC checks passed successfully");
  if (financialScore >= 70) strengths.push("Strong financial documentation");
  if (app.business.yearsInOperation && app.business.yearsInOperation >= 3)
    strengths.push(`${app.business.yearsInOperation} years in operation`);
  if ((app as any).systemSizeKwp) strengths.push(`${(app as any).systemSizeKwp} kWp system specified`);
  if (bureauScore !== null && bureauScore >= 65)
    strengths.push(`Clean bureau history (FirstCentral: ${bureauRating})`);

  if (kycScore < 60) risks.push("Incomplete or failed KYC verification");
  if (financialScore < 50) risks.push("Insufficient financial documentation");
  if (!app.collateralType) risks.push("No collateral provided");
  if (app.business.directors.length < 1) risks.push("No director / guarantor information provided");
  if (bureauScore !== null && bureauScore < 40)
    risks.push(`Adverse bureau record detected (FirstCentral: ${bureauRating})`);
  if (IS_FIRSTCENTRAL_CONFIGURED && bureauScore === null)
    risks.push("Bureau lookup returned no credit history");

  if (recommendation === "APPROVE" && !app.collateralType)
    conditions.push("Provide acceptable collateral before disbursement");
  if (financialScore < 70)
    conditions.push("Provide additional financial statements");
  if (!app.documents.some((d) => d.type === "ELECTRICITY_BILL"))
    conditions.push("Submit recent electricity bill to validate energy consumption");

  const summary = buildSummary(app, totalScore, recommendation, bureauScore, bureauRating);

  return {
    totalScore,
    scoreGrade,
    recommendation,
    kycScore,
    financialScore,
    projectViabilityScore,
    collateralScore,
    bureauScore,
    bureauProvider,
    bureauReference,
    bureauRawData,
    summary,
    strengths,
    risks,
    conditions,
  };
}

function scoreKYC(app: ApplicationWithRelations): number {
  let score = 0;
  const { kycChecks, business } = app;

  const cacCheck = kycChecks.find((k) => k.checkType === "CAC");
  if (cacCheck?.status === "PASSED") score += 40;

  const passedBVNs = business.directors.filter((d) => d.kycStatus === "PASSED").length;
  const totalDirectors = business.directors.length;
  if (totalDirectors > 0) score += Math.round((passedBVNs / totalDirectors) * 60);

  return Math.min(score, 100);
}

function scoreFinancials(app: ApplicationWithRelations): number {
  let score = 0;
  const docTypes = app.documents.map((d) => d.type);

  if (docTypes.includes("AUDITED_FINANCIALS")) score += 40;
  if (docTypes.includes("BANK_STATEMENT")) score += 30;
  if (docTypes.includes("INSTALLATION_QUOTE")) score += 20;
  if (docTypes.includes("ELECTRICITY_BILL")) score += 10;

  return Math.min(score, 100);
}

function scoreProjectViability(app: ApplicationWithRelations): number {
  let score = 0;
  const { business } = app;
  const docTypes = app.documents.map((d) => d.type);

  // Years in operation — longer track record = more reliable repayment
  if (business.yearsInOperation) {
    if (business.yearsInOperation >= 5) score += 35;
    else if (business.yearsInOperation >= 3) score += 22;
    else if (business.yearsInOperation >= 1) score += 10;
  }

  // Monthly energy bill — high bill = strong motivation + repayment capacity via savings
  if (business.monthlyEnergyBill) {
    const bill = Number(business.monthlyEnergyBill);
    if (bill >= 500000) score += 30;
    else if (bill >= 200000) score += 20;
    else if (bill >= 50000) score += 10;
  }

  // Site assessment report submitted
  if (docTypes.includes("SITE_ASSESSMENT")) score += 20;

  // Property proof (confirms installation is possible)
  if (docTypes.includes("PROPERTY_PROOF")) score += 15;

  return Math.min(score, 100);
}

function scoreCollateral(app: ApplicationWithRelations): number {
  if (!app.collateralType) return 0;

  let score = 50;

  if (app.collateralValue && Number(app.amountRequested) > 0) {
    const ltv = Number(app.collateralValue) / Number(app.amountRequested);
    if (ltv >= 1.5) score += 50;
    else if (ltv >= 1.2) score += 35;
    else if (ltv >= 1.0) score += 20;
  }

  return Math.min(score, 100);
}

function getGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function buildSummary(
  app: ApplicationWithRelations,
  score: number,
  recommendation: string,
  bureauScore?: number | null,
  bureauRating?: string | null
): string {
  const business = app.business;
  const amount = Number(app.amountRequested).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });
  const systemType = (app as any).systemType?.replace(/_/g, " ") ?? "Solar";
  const sizeStr = (app as any).systemSizeKwp ? ` (${(app as any).systemSizeKwp} kWp)` : "";

  const bureauLine = bureauScore !== null && bureauScore !== undefined
    ? ` FirstCentral bureau check returned a normalised score of ${bureauScore}/100 (${bureauRating}).`
    : "";

  return (
    `${business.registeredName} is requesting a ${app.tenor}-month solar finance facility of ${amount} ` +
    `for a ${systemType}${sizeStr} solar installation. ` +
    `The business has been in operation for ${business.yearsInOperation ?? "an unknown number of"} years.` +
    bureauLine +
    ` Credit score: ${score}/100 (Grade ${getGrade(score)}). Recommendation: ${recommendation}.`
  );
}
