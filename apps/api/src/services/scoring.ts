import { LoanApplication, Business, Director, Document, KYCCheck } from "@prisma/client";
import { aggregateDirectorBureauScore, IS_FIRSTCENTRAL_CONFIGURED, scoreRating } from "./firstcentral";
import { DocumentInsights } from "./documentAnalysis";

type ApplicationWithRelations = LoanApplication & {
  business: Business & { directors: Director[] };
  documents: Document[];
  kycChecks: KYCCheck[];
};

export async function generateCreditProfile(
  app: ApplicationWithRelations,
  docInsights?: DocumentInsights,
) {
  const kycScore = scoreKYC(app);
  const financialScore = scoreFinancials(app, docInsights);
  const projectViabilityScore = scoreProjectViability(app, docInsights);
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

  // ── Heuristic strengths / risks ───────────────────────────────────────────
  if (kycScore >= 80) strengths.push("All KYC checks passed successfully");
  if (app.business.yearsInOperation && app.business.yearsInOperation >= 3)
    strengths.push(`${app.business.yearsInOperation} years in operation`);
  if ((app as any).systemSizeKwp) strengths.push(`${(app as any).systemSizeKwp} kWp system specified`);
  if (bureauScore !== null && bureauScore >= 65)
    strengths.push(`Clean bureau history (FirstCentral: ${bureauRating})`);

  if (kycScore < 60) risks.push("Incomplete or failed KYC verification");
  if (!app.collateralType) risks.push("No collateral provided");
  if (app.business.directors.length < 1) risks.push("No director / guarantor information provided");
  if (bureauScore !== null && bureauScore < 40)
    risks.push(`Adverse bureau record detected (FirstCentral: ${bureauRating})`);
  if (IS_FIRSTCENTRAL_CONFIGURED && bureauScore === null)
    risks.push("Bureau lookup returned no credit history");

  // ── Document-derived strengths / risks ────────────────────────────────────
  if (docInsights) {
    const fi = docInsights.auditedFinancials;
    const bs = docInsights.bankStatement;
    const si = docInsights.siteAssessment;
    const iq = docInsights.installationQuote;

    if (fi) {
      if (fi.annualRevenue !== null && fi.annualRevenue > 0) {
        const coverageRatio = fi.annualRevenue / Number(app.amountRequested);
        if (coverageRatio >= 3) strengths.push(`Strong revenue coverage: ₦${fmt(fi.annualRevenue)} annual revenue vs ₦${fmt(Number(app.amountRequested))} loan`);
        else if (coverageRatio < 1) risks.push(`Low revenue vs loan amount (₦${fmt(fi.annualRevenue)} revenue, ₦${fmt(Number(app.amountRequested))} requested)`);
      }
      if (fi.netProfit !== null && fi.netProfit > 0) strengths.push(`Profitable business (net profit: ₦${fmt(fi.netProfit)})`);
      if (fi.netProfit !== null && fi.netProfit < 0) risks.push(`Business reported a net loss of ₦${fmt(Math.abs(fi.netProfit))}`);
      if (fi.profitMargin !== null && fi.profitMargin >= 15) strengths.push(`Healthy profit margin (${fi.profitMargin.toFixed(1)}%)`);
      if (fi.goingConcernIssue) risks.push("Going concern qualification noted in audited accounts");
      if (fi.auditorQualified) risks.push("Auditor's report contains qualifications");
      if (fi.totalLiabilities !== null && fi.totalAssets !== null && fi.totalAssets > 0) {
        const leverageRatio = fi.totalLiabilities / fi.totalAssets;
        if (leverageRatio > 0.8) risks.push(`High leverage ratio (${(leverageRatio * 100).toFixed(0)}% of assets are liabilities)`);
      }
      fi.flags.forEach((f) => risks.push(f));
    }

    if (bs) {
      if (bs.averageMonthlyBalance !== null && bs.averageMonthlyBalance > 0) {
        const monthlyRepayment = Number(app.amountRequested) / Number((app as any).tenor ?? 12);
        if (bs.averageMonthlyBalance >= monthlyRepayment * 3)
          strengths.push(`Bank balance supports repayment (avg balance: ₦${fmt(bs.averageMonthlyBalance)})`);
        else if (bs.averageMonthlyBalance < monthlyRepayment)
          risks.push(`Average bank balance (₦${fmt(bs.averageMonthlyBalance)}) is below estimated monthly repayment`);
      }
      if (bs.totalCreditTurnover12m !== null && bs.totalCreditTurnover12m > 0)
        strengths.push(`12-month credit turnover: ₦${fmt(bs.totalCreditTurnover12m)}`);
      if (bs.hasLoansOrOverdrafts)
        risks.push("Existing loans or overdraft facility detected on bank statement");
      bs.irregularities.forEach((i) => risks.push(i));
    }

    if (si) {
      if (si.siteViable === true) strengths.push("Site assessment confirms installation is viable");
      if (si.siteViable === false) risks.push("Site assessment flagged potential installation issues");
      const appSizeKwp = (app as any).systemSizeKwp;
      if (si.recommendedSystemSizeKwp && appSizeKwp) {
        const diff = Math.abs(si.recommendedSystemSizeKwp - appSizeKwp) / si.recommendedSystemSizeKwp;
        if (diff > 0.25) risks.push(`System size mismatch: application states ${appSizeKwp} kWp but site assessment recommends ${si.recommendedSystemSizeKwp} kWp`);
      }
      si.notes.forEach((n) => conditions.push(n));
    }

    if (iq) {
      if (iq.installerName) strengths.push(`Installer quotation provided by ${iq.installerName}`);
      if (iq.totalQuoteAmount !== null) {
        const loanVsQuote = Number(app.amountRequested) / iq.totalQuoteAmount;
        if (loanVsQuote > 1.3) conditions.push(`Loan amount (₦${fmt(Number(app.amountRequested))}) exceeds installer quote by more than 30% — verify use of funds`);
      }
    }

    docInsights.generalFlags.forEach((f) => risks.push(f));
  }

  // ── Conditions ────────────────────────────────────────────────────────────
  if (recommendation === "APPROVE" && !app.collateralType)
    conditions.push("Provide acceptable collateral before disbursement");
  if (financialScore < 70 && !docInsights?.auditedFinancials)
    conditions.push("Provide additional financial statements");
  if (!app.documents.some((d) => d.type === "ELECTRICITY_BILL"))
    conditions.push("Submit recent electricity bill to validate energy consumption");

  const summary = buildSummary(app, totalScore, recommendation, bureauScore, bureauRating, docInsights);

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

// ── Sub-scorers ───────────────────────────────────────────────────────────────

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

function scoreFinancials(
  app: ApplicationWithRelations,
  insights?: DocumentInsights,
): number {
  const docTypes = app.documents.map((d) => d.type);

  // Base score: presence of required documents (unchanged baseline)
  let score = 0;
  if (docTypes.includes("AUDITED_FINANCIALS")) score += 20;
  if (docTypes.includes("BANK_STATEMENT")) score += 15;
  if (docTypes.includes("INSTALLATION_QUOTE")) score += 10;
  if (docTypes.includes("ELECTRICITY_BILL")) score += 5;
  // Up to 50 from document presence

  if (!insights) return Math.min(score, 100);

  // Content-based scoring (up to 50 additional points)
  const fi = insights.auditedFinancials;
  const bs = insights.bankStatement;

  if (fi) {
    // Revenue vs loan amount
    if (fi.annualRevenue !== null && fi.annualRevenue > 0) {
      const coverage = fi.annualRevenue / Number(app.amountRequested);
      if (coverage >= 5)       score += 20;
      else if (coverage >= 3)  score += 15;
      else if (coverage >= 1)  score += 8;
      // negative if revenue is less than loan: don't add anything
    }
    // Profitability
    if (fi.netProfit !== null) {
      if (fi.netProfit > 0)    score += 10;
      else                      score -= 10; // loss penalised
    }
    // Deduct for qualifications
    if (fi.goingConcernIssue)  score -= 15;
    if (fi.auditorQualified)   score -= 5;
  }

  if (bs) {
    const monthlyRepayment = Number(app.amountRequested) / Number((app as any).tenor ?? 12);
    if (bs.averageMonthlyBalance !== null) {
      const balanceCoverage = bs.averageMonthlyBalance / monthlyRepayment;
      if (balanceCoverage >= 6)      score += 15;
      else if (balanceCoverage >= 3) score += 10;
      else if (balanceCoverage >= 1) score += 5;
      else                           score -= 5;
    }
    if (bs.hasLoansOrOverdrafts)     score -= 5;
  }

  return Math.min(Math.max(score, 0), 100);
}

function scoreProjectViability(
  app: ApplicationWithRelations,
  insights?: DocumentInsights,
): number {
  let score = 0;
  const { business } = app;
  const docTypes = app.documents.map((d) => d.type);

  // Years in operation
  if (business.yearsInOperation) {
    if (business.yearsInOperation >= 5)      score += 35;
    else if (business.yearsInOperation >= 3) score += 22;
    else if (business.yearsInOperation >= 1) score += 10;
  }

  // Energy bill — prefer extracted figure over DB field (more accurate)
  const extractedBill = insights?.electricityBill?.averageMonthlyAmount ?? null;
  const storedBill = business.monthlyEnergyBill ? Number(business.monthlyEnergyBill) : null;
  const energyBill = extractedBill ?? storedBill;

  if (energyBill !== null && energyBill > 0) {
    if (energyBill >= 500000)      score += 30;
    else if (energyBill >= 200000) score += 20;
    else if (energyBill >= 50000)  score += 10;
  }

  // Site assessment (document presence)
  if (docTypes.includes("SITE_ASSESSMENT")) score += 10;

  // Site assessment content
  if (insights?.siteAssessment) {
    if (insights.siteAssessment.siteViable === true)  score += 10;
    if (insights.siteAssessment.siteViable === false) score -= 15;
  }

  // Property proof
  if (docTypes.includes("PROPERTY_PROOF")) score += 15;

  return Math.min(Math.max(score, 0), 100);
}

function scoreCollateral(app: ApplicationWithRelations): number {
  if (!app.collateralType) return 0;

  let score = 50;

  if (app.collateralValue && Number(app.amountRequested) > 0) {
    const ltv = Number(app.collateralValue) / Number(app.amountRequested);
    if (ltv >= 1.5)      score += 50;
    else if (ltv >= 1.2) score += 35;
    else if (ltv >= 1.0) score += 20;
  }

  return Math.min(score, 100);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function fmt(n: number): string {
  return n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

function buildSummary(
  app: ApplicationWithRelations,
  score: number,
  recommendation: string,
  bureauScore?: number | null,
  bureauRating?: string | null,
  docInsights?: DocumentInsights,
): string {
  const business = app.business;
  const amount = Number(app.amountRequested).toLocaleString("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0,
  });
  const systemType = (app as any).systemType?.replace(/_/g, " ") ?? "Solar";
  const sizeStr = (app as any).systemSizeKwp ? ` (${(app as any).systemSizeKwp} kWp)` : "";

  const bureauLine = bureauScore !== null && bureauScore !== undefined
    ? ` FirstCentral bureau check returned a normalised score of ${bureauScore}/100 (${bureauRating}).`
    : "";

  let docLine = "";
  if (docInsights?.auditedFinancials?.annualRevenue) {
    docLine += ` Audited revenue: ₦${fmt(docInsights.auditedFinancials.annualRevenue)}.`;
  }
  if (docInsights?.bankStatement?.totalCreditTurnover12m) {
    docLine += ` 12-month bank turnover: ₦${fmt(docInsights.bankStatement.totalCreditTurnover12m)}.`;
  }
  if (docInsights?.electricityBill?.averageMonthlyAmount) {
    docLine += ` Average monthly energy cost: ₦${fmt(docInsights.electricityBill.averageMonthlyAmount)}.`;
  }

  return (
    `${business.registeredName} is requesting a ${app.tenor}-month solar finance facility of ${amount} ` +
    `for a ${systemType}${sizeStr} solar installation. ` +
    `The business has been in operation for ${business.yearsInOperation ?? "an unknown number of"} years.` +
    bureauLine + docLine +
    ` Credit score: ${score}/100 (Grade ${getGrade(score)}). Recommendation: ${recommendation}.`
  );
}
