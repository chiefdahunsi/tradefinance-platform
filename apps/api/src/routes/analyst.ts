import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@tradefinance/db";
import { requireAuth, AuthRequest, requireRole } from "../middleware/auth";
import { generateCreditProfile } from "../services/scoring";
import { sendDecision } from "../services/email";
import { audit, AuditAction } from "../services/audit";

const router = Router();
router.use(requireAuth, requireRole("ANALYST", "ADMIN"));

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "DECLINED", "MORE_INFO_REQUIRED"]),
  amountApproved: z.number().optional(),
  tenorApproved: z.number().optional(),
  interestRate: z.number().optional(),
  conditions: z.array(z.string()).optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});

// Assign application to self
router.post(
  "/:applicationId/assign",
  async (req: AuthRequest, res: Response) => {
    const existing = await prisma.analystReview.findUnique({
      where: { applicationId: req.params.applicationId },
    });

    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Application already assigned" });
    }

    const review = await prisma.analystReview.create({
      data: {
        applicationId: req.params.applicationId,
        analystId: req.user!.userId,
      },
    });

    await prisma.loanApplication.update({
      where: { id: req.params.applicationId },
      data: { status: "UNDER_REVIEW" },
    });

    audit({ entityType: "LoanApplication", entityId: req.params.applicationId, action: AuditAction.APPLICATION_ASSIGNED, actorId: req.user!.userId, req });

    return res.json({ success: true, data: review });
  }
);

// Generate credit profile for an application
router.post(
  "/:applicationId/generate-profile",
  async (req: AuthRequest, res: Response) => {
    const application = await prisma.loanApplication.findUnique({
      where: { id: req.params.applicationId },
      include: {
        business: { include: { directors: true } },
        documents: true,
        kycChecks: true,
      },
    });

    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    const profile = await generateCreditProfile(application as any);

    const saved = await prisma.creditProfile.upsert({
      where: { applicationId: application.id },
      create: { ...profile, applicationId: application.id },
      update: profile,
    });

    audit({ entityType: "LoanApplication", entityId: req.params.applicationId, action: AuditAction.CREDIT_PROFILE_GENERATED, actorId: req.user!.userId, req });

    return res.json({ success: true, data: saved });
  }
);

// Submit decision
router.post(
  "/:applicationId/decision",
  async (req: AuthRequest, res: Response) => {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    const review = await prisma.analystReview.update({
      where: { applicationId: req.params.applicationId },
      data: { ...parsed.data, decidedAt: new Date() },
    });

    const statusMap = {
      APPROVED: "APPROVED",
      DECLINED: "DECLINED",
      MORE_INFO_REQUIRED: "MORE_INFO_REQUIRED",
    } as const;

    await prisma.loanApplication.update({
      where: { id: req.params.applicationId },
      data: { status: statusMap[parsed.data.decision] },
    });

    audit({ entityType: "LoanApplication", entityId: req.params.applicationId, action: AuditAction.DECISION_SUBMITTED, actorId: req.user!.userId, changes: { decision: parsed.data.decision }, req });

    // Send decision email to SME (non-blocking)
    const fullApp = await prisma.loanApplication.findUnique({
      where: { id: req.params.applicationId },
      include: { business: { include: { user: true } } },
    });

    if (fullApp) {
      sendDecision({
        to: fullApp.business.user.email,
        firstName: fullApp.business.user.firstName,
        businessName: fullApp.business.registeredName,
        referenceNumber: fullApp.referenceNumber,
        decision: parsed.data.decision,
        amountApproved: parsed.data.amountApproved,
        tenorApproved: parsed.data.tenorApproved,
        interestRate: parsed.data.interestRate ? Number(parsed.data.interestRate) : undefined,
        conditions: parsed.data.conditions,
        notes: parsed.data.notes,
      }).catch((err) => console.error("Decision email error:", err));
    }

    return res.json({ success: true, data: review });
  }
);

// Get analyst's queue
router.get("/queue", async (req: AuthRequest, res: Response) => {
  const reviews = await prisma.analystReview.findMany({
    where: { analystId: req.user!.userId, decidedAt: null },
    include: {
      application: {
        include: {
          business: { select: { registeredName: true, commodities: true, state: true } },
          creditProfile: { select: { totalScore: true, scoreGrade: true, recommendation: true } },
        },
      },
    },
    orderBy: { assignedAt: "asc" },
  });

  return res.json({ success: true, data: reviews });
});

export default router;
