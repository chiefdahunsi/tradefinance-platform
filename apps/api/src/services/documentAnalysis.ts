import { spawn } from "child_process";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuid } from "uuid";
import { Readable } from "stream";
import { Document } from "@prisma/client";

// ── Public types ───────────────────────────────────────────────────────────────

export interface DocumentInsights {
  auditedFinancials: {
    annualRevenue: number | null;
    netProfit: number | null;
    totalAssets: number | null;
    totalLiabilities: number | null;
    profitMargin: number | null;
    goingConcernIssue: boolean;
    auditorQualified: boolean;
    flags: string[];
  } | null;
  bankStatement: {
    averageMonthlyBalance: number | null;
    totalCreditTurnover12m: number | null;
    hasLoansOrOverdrafts: boolean;
    irregularities: string[];
  } | null;
  electricityBill: {
    averageMonthlyAmount: number | null;
  } | null;
  siteAssessment: {
    recommendedSystemSizeKwp: number | null;
    siteViable: boolean | null;
    notes: string[];
  } | null;
  installationQuote: {
    totalQuoteAmount: number | null;
    installerName: string | null;
    systemSizeKwp: number | null;
  } | null;
  generalFlags: string[];
  documentsSummarized: string[];
}

// ── markitdown subprocess ─────────────────────────────────────────────────────

async function toMarkdown(buffer: Buffer, ext: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `${uuid()}${ext}`);
  fs.writeFileSync(tmpFile, buffer);
  return new Promise<string>((resolve) => {
    let out = "";
    let errOut = "";
    const proc = spawn("python3", ["-m", "markitdown", tmpFile]);
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { errOut += d.toString(); });
    proc.on("close", (code) => {
      fs.unlink(tmpFile, () => {});
      if (code !== 0) resolve(`[markitdown exited with code ${code}: ${errOut.trim() || "no detail"}]`);
      else resolve(out.trim() || "[No text extracted — document may be empty or image-only]");
    });
    proc.on("error", () => {
      fs.unlink(tmpFile, () => {});
      resolve("[markitdown unavailable]");
    });
  });
}

async function fetchFileBuffer(doc: Document, s3: S3Client | null, bucket: string): Promise<Buffer> {
  if (s3 && doc.fileUrl.startsWith("s3://")) {
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: doc.fileKey }));
    const chunks: Buffer[] = [];
    for await (const chunk of obj.Body as Readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  return fs.readFileSync(path.join(process.cwd(), doc.fileUrl));
}

// ── Decision tree: number extraction helpers ──────────────────────────────────

/**
 * Try each pattern in order; return the first match as a cleaned number.
 * Patterns should have one capture group containing the raw number string.
 */
function firstMatch(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]) {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

/** Return all non-overlapping matches of a pattern as numbers. */
function allMatches(text: string, re: RegExp): number[] {
  const results: number[] = [];
  let m: RegExpExecArray | null;
  const copy = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = copy.exec(text)) !== null) {
    const n = parseFloat((m[1] ?? m[0]).replace(/,/g, ""));
    if (!isNaN(n) && n > 0) results.push(n);
  }
  return results;
}

/** Naira currency — handles ₦, N, NGN prefixes with optional spaces. */
const naira = (keyword: string) =>
  new RegExp(`${keyword}[\\s\\S]{0,60}?[₦N]\\s*([\\d,]+(?:\\.\\d{1,2})?)`, "i");

const nairaAfter = (keyword: string) =>
  new RegExp(`${keyword}[\\s:]+(?:₦|NGN\\s*)?([\\d,]+(?:\\.\\d{1,2})?)`, "i");

// ── Document-type decision trees ──────────────────────────────────────────────

function parseAuditedFinancials(md: string): DocumentInsights["auditedFinancials"] {
  const t = md.toLowerCase();
  const flags: string[] = [];

  // ── Revenue ──────────────────────────────────────────────────────────────
  const annualRevenue = firstMatch(md, [
    nairaAfter("(?:total\\s+)?(?:revenue|turnover)"),
    nairaAfter("gross\\s+(?:earnings|income)"),
    naira("(?:revenue|turnover)"),
  ]);

  // ── Net profit / loss ────────────────────────────────────────────────────
  const netProfitRaw = firstMatch(md, [
    nairaAfter("(?:profit|loss)\\s+(?:after|for)\\s+the\\s+(?:year|period)"),
    nairaAfter("net\\s+(?:profit|income|loss)"),
    nairaAfter("(?:profit|loss)\\s+after\\s+tax"),
  ]);

  // Determine sign: if the adjacent context contains "loss" without "profit" it's negative
  let netProfit = netProfitRaw;
  if (netProfitRaw !== null) {
    const context = md.match(/(?:net\s+(?:profit|loss)|profit\s+after\s+tax)[^\n]{0,80}/i)?.[0] ?? "";
    if (/\bloss\b/i.test(context) && !/\bprofit\b/i.test(context.replace(/net profit/i, ""))) {
      netProfit = -netProfitRaw;
    }
  }

  // ── Assets / liabilities ─────────────────────────────────────────────────
  const totalAssets = firstMatch(md, [
    nairaAfter("total\\s+assets"),
    nairaAfter("net\\s+assets"),
  ]);
  const totalLiabilities = firstMatch(md, [
    nairaAfter("total\\s+liabilities"),
    nairaAfter("total\\s+(?:debt|borrowings)"),
  ]);

  // ── Profit margin ─────────────────────────────────────────────────────────
  let profitMargin: number | null = null;
  if (annualRevenue && netProfit !== null) {
    profitMargin = Math.round((netProfit / annualRevenue) * 1000) / 10;
  }

  // ── Auditor flags (decision nodes) ───────────────────────────────────────
  const goingConcernIssue = /going[\s-]concern/i.test(t);
  const auditorQualified =
    /\b(qualified|adverse|disclaimer)\s+(opinion|report)\b/i.test(t) ||
    /\bexcept\s+for\b/i.test(t);

  if (goingConcernIssue) flags.push("Going concern note present in auditor's report");
  if (auditorQualified)  flags.push("Auditor's report contains a qualification");

  if (totalAssets !== null && totalLiabilities !== null && totalAssets > 0) {
    const leverage = totalLiabilities / totalAssets;
    if (leverage > 0.8) flags.push(`High leverage: liabilities are ${(leverage * 100).toFixed(0)}% of total assets`);
  }

  if (!annualRevenue && !netProfit && !totalAssets) return null; // nothing extracted

  return { annualRevenue, netProfit, totalAssets, totalLiabilities, profitMargin, goingConcernIssue, auditorQualified, flags };
}

function parseBankStatement(md: string): DocumentInsights["bankStatement"] {
  const t = md.toLowerCase();
  const irregularities: string[] = [];

  // ── Balances ─────────────────────────────────────────────────────────────
  // Find all closing/available balances and average them
  const balancePattern = /(?:closing|available|ledger|end[\s-]of[\s-](?:month|period))\s+balance[^\n]{0,40}[₦N]\s*([\d,]+(?:\.\d{1,2})?)/gi;
  const balances = allMatches(md, balancePattern);
  const averageMonthlyBalance = balances.length > 0
    ? Math.round(balances.reduce((a, b) => a + b, 0) / balances.length)
    : firstMatch(md, [nairaAfter("(?:average|avg)\\s+(?:monthly\\s+)?balance"), nairaAfter("(?:closing|available)\\s+balance")]);

  // ── Credit turnover ───────────────────────────────────────────────────────
  const totalCreditTurnover12m = firstMatch(md, [
    nairaAfter("total\\s+(?:credit(?:s)?|inflow(?:s)?)"),
    nairaAfter("(?:annual|12[\\s-]month|yearly)\\s+(?:credit|inflow)"),
    nairaAfter("total\\s+deposits"),
  ]);

  // ── Loans / overdrafts (decision node) ───────────────────────────────────
  const hasLoansOrOverdrafts =
    /\b(overdraft|loan\s+outstanding|facility\s+outstanding|debit\s+balance)\b/i.test(t);

  // ── Irregularities ────────────────────────────────────────────────────────
  if (/\b(nip\s+return|unpaid|bounced|dishonoured|returned\s+cheque)\b/i.test(t))
    irregularities.push("Returned/bounced transactions detected");
  if (/\b(fraud|fraudulent|suspicious)\b/i.test(t))
    irregularities.push("Suspicious transaction language found");
  if (hasLoansOrOverdrafts)
    irregularities.push("Outstanding loan or overdraft facility on account");

  if (!averageMonthlyBalance && !totalCreditTurnover12m) return null;

  return { averageMonthlyBalance, totalCreditTurnover12m, hasLoansOrOverdrafts, irregularities };
}

function parseElectricityBill(md: string): DocumentInsights["electricityBill"] {
  const averageMonthlyAmount = firstMatch(md, [
    nairaAfter("(?:amount\\s+due|total\\s+amount|invoice\\s+total|current\\s+charges)"),
    nairaAfter("(?:energy|electricity|power)\\s+charge"),
    nairaAfter("total\\s+(?:payable|bill)"),
    // table cell pattern: just a large naira amount on its own line
    /[₦N]\s*([\d,]{4,}(?:\.\d{1,2})?)/,
  ]);
  if (!averageMonthlyAmount) return null;
  return { averageMonthlyAmount };
}

function parseSiteAssessment(md: string): DocumentInsights["siteAssessment"] {
  const notes: string[] = [];

  // ── System size ───────────────────────────────────────────────────────────
  const recommendedSystemSizeKwp = firstMatch(md, [
    /([\d.]+)\s*kWp?\s*(?:system|installation|pv|solar)/i,
    /(?:recommended|proposed|required|system)\s+(?:size|capacity)[^\n]{0,30}([\d.]+)\s*kWp?/i,
    /(?:install|deploy)\s+([\d.]+)\s*kWp?/i,
  ]);

  // ── Viability decision node ───────────────────────────────────────────────
  const t = md.toLowerCase();
  let siteViable: boolean | null = null;
  if (/\b(site\s+is\s+(?:suitable|viable|approved|recommended)|installation\s+is\s+feasible)\b/i.test(t))
    siteViable = true;
  else if (/\b(not\s+(?:suitable|viable|recommended)|installation\s+not\s+feasible|site\s+rejected)\b/i.test(t))
    siteViable = false;

  // Capture any explicit notes from the document
  const notesMatch = md.match(/(?:note|recommendation|observation)[s]?[:\s]+([^\n]{20,200})/gi);
  if (notesMatch) notes.push(...notesMatch.slice(0, 3).map((n) => n.replace(/^[^\s]+\s*:\s*/i, "").trim()));

  if (!recommendedSystemSizeKwp && siteViable === null) return null;

  return { recommendedSystemSizeKwp, siteViable, notes };
}

function parseInstallationQuote(md: string): DocumentInsights["installationQuote"] {
  const totalQuoteAmount = firstMatch(md, [
    nairaAfter("(?:grand\\s+)?total(?:\\s+quote)?(?:\\s+amount)?"),
    nairaAfter("total\\s+(?:cost|price|value|sum)"),
    nairaAfter("(?:quotation|quote)\\s+(?:total|amount|value)"),
    nairaAfter("amount\\s+(?:payable|due)"),
  ]);

  const systemSizeKwp = firstMatch(md, [
    /([\d.]+)\s*kWp?/i,
  ]);

  // Try to extract installer company name (first line or after "Company:" keyword)
  const installerName =
    md.match(/(?:company|installer|vendor|contractor|by)[:\s]+([A-Z][A-Za-z\s&().,-]{5,60})/)?.[1]?.trim()
    ?? md.split("\n").find((l) => l.trim().length > 5 && /Ltd|Limited|Nig|Solar|Energy|Tech|Power/i.test(l))?.trim()
    ?? null;

  if (!totalQuoteAmount && !systemSizeKwp) return null;

  return { totalQuoteAmount, installerName, systemSizeKwp };
}

// ── Cross-document validation ─────────────────────────────────────────────────

function crossValidate(insights: Omit<DocumentInsights, "generalFlags" | "documentsSummarized">): string[] {
  const flags: string[] = [];

  const revenue = insights.auditedFinancials?.annualRevenue;
  const turnover = insights.bankStatement?.totalCreditTurnover12m;
  if (revenue && turnover) {
    const ratio = Math.max(revenue, turnover) / Math.min(revenue, turnover);
    if (ratio > 3) {
      flags.push(
        `Revenue mismatch: audited financials show ₦${fmt(revenue)} but bank statement credits are ₦${fmt(turnover)} — large discrepancy warrants investigation`
      );
    }
  }

  const quoteSizeKwp = insights.installationQuote?.systemSizeKwp;
  const assessmentSizeKwp = insights.siteAssessment?.recommendedSystemSizeKwp;
  if (quoteSizeKwp && assessmentSizeKwp) {
    const diff = Math.abs(quoteSizeKwp - assessmentSizeKwp) / assessmentSizeKwp;
    if (diff > 0.2) {
      flags.push(
        `System size mismatch: installation quote specifies ${quoteSizeKwp} kWp but site assessment recommends ${assessmentSizeKwp} kWp`
      );
    }
  }

  return flags;
}

function fmt(n: number) {
  return n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function analyseDocuments(
  documents: Document[],
  s3: S3Client | null,
  bucket: string,
): Promise<DocumentInsights> {
  if (documents.length === 0) {
    return { auditedFinancials: null, bankStatement: null, electricityBill: null, siteAssessment: null, installationQuote: null, generalFlags: ["No documents uploaded"], documentsSummarized: [] };
  }

  // Step 1: convert every document to Markdown
  const sections = await Promise.all(
    documents.map(async (doc) => {
      try {
        const buffer = await fetchFileBuffer(doc, s3, bucket);
        const ext = path.extname(doc.fileName) || ".pdf";
        const md = await toMarkdown(buffer, ext);
        return { type: doc.type as string, md };
      } catch {
        return { type: doc.type as string, md: "" };
      }
    })
  );

  // Step 2: apply per-type decision trees
  // Multiple uploads of the same type → concatenate markdown before parsing
  const byType = new Map<string, string>();
  for (const { type, md } of sections) {
    byType.set(type, (byType.get(type) ?? "") + "\n\n" + md);
  }

  const partial = {
    auditedFinancials: byType.has("AUDITED_FINANCIALS") ? parseAuditedFinancials(byType.get("AUDITED_FINANCIALS")!) : null,
    bankStatement:     byType.has("BANK_STATEMENT")     ? parseBankStatement(byType.get("BANK_STATEMENT")!)     : null,
    electricityBill:   byType.has("ELECTRICITY_BILL")   ? parseElectricityBill(byType.get("ELECTRICITY_BILL")!) : null,
    siteAssessment:    byType.has("SITE_ASSESSMENT")     ? parseSiteAssessment(byType.get("SITE_ASSESSMENT")!)   : null,
    installationQuote: byType.has("INSTALLATION_QUOTE") ? parseInstallationQuote(byType.get("INSTALLATION_QUOTE")!) : null,
  };

  // Step 3: cross-document validation flags
  const generalFlags = crossValidate(partial);

  return {
    ...partial,
    generalFlags,
    documentsSummarized: Array.from(byType.keys()),
  };
}
