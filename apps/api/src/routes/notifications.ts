import { Router, Response } from "express";
import { prisma } from "@tradefinance/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Get recent activity for the current SME's applications
router.get("/", async (req: AuthRequest, res: Response) => {
  const business = await prisma.business.findUnique({
    where: { userId: req.user!.userId },
    include: { applications: { select: { id: true } } },
  });

  if (!business) return res.json({ success: true, data: [] });

  const applicationIds = business.applications.map((a) => a.id);

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: "LoanApplication",
      entityId: { in: applicationIds },
      action: {
        in: [
          "APPLICATION:SUBMITTED",
          "KYC:PASSED",
          "KYC:FAILED",
          "ANALYST:ASSIGNED",
          "ANALYST:DECISION_SUBMITTED",
          "ANALYST:CREDIT_PROFILE_GENERATED",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Enrich with application reference numbers
  const apps = await prisma.loanApplication.findMany({
    where: { id: { in: applicationIds } },
    select: { id: true, referenceNumber: true, systemType: true },
  });
  const appMap = Object.fromEntries(apps.map((a) => [a.id, a]));

  const LABELS: Record<string, string> = {
    "APPLICATION:SUBMITTED": "Application submitted",
    "KYC:PASSED": "KYC verification passed",
    "KYC:FAILED": "KYC verification issue",
    "ANALYST:ASSIGNED": "Assigned to an analyst",
    "ANALYST:CREDIT_PROFILE_GENERATED": "Credit profile generated",
    "ANALYST:DECISION_SUBMITTED": "Decision made on your application",
  };

  const notifications = logs.map((log) => {
    const app = appMap[log.entityId];
    const decision = (log.changes as any)?.decision;
    return {
      id: log.id,
      applicationId: log.entityId,
      referenceNumber: app?.referenceNumber?.slice(0, 8).toUpperCase() ?? "—",
      systemType: app?.systemType ?? "",
      action: log.action,
      label: decision
        ? `Application ${decision.toLowerCase()}`
        : LABELS[log.action] ?? log.action,
      isDecision: !!decision,
      decision,
      createdAt: log.createdAt,
    };
  });

  return res.json({ success: true, data: notifications });
});

export default router;
