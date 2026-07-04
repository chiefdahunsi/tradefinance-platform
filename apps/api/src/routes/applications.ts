import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@tradefinance/db";
import { requireAuth, AuthRequest, requireRole } from "../middleware/auth";
import { verifyBVN, verifyCAC } from "../services/kyc";
import { sendApplicationSubmitted, sendKYCResult } from "../services/email";
import { audit, AuditAction } from "../services/audit";

const router = Router();

const applicationSchema = z.object({
  amountRequested: z.number().positive(),
  tenor: z.number().int().min(1).max(84),
  purpose: z.string().min(10),
  systemType: z.string(),
  systemSizeKwp: z.number().positive().optional(),
  projectAddress: z.string().optional(),
  projectDescription: z.string().min(20),
  collateralType: z.string().optional(),
  collateralValue: z.number().optional(),
  collateralDetails: z.string().optional(),
});

router.use(requireAuth);

// Create application
router.post("/", async (req: AuthRequest, res: Response) => {
  const business = await prisma.business.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!business) {
    return res
      .status(400)
      .json({ success: false, message: "Complete your business profile first" });
  }

  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const application = await prisma.loanApplication.create({
    data: { ...parsed.data, businessId: business.id, systemType: parsed.data.systemType as any },
  });

  return res.status(201).json({ success: true, data: application });
});

// Submit application (move from DRAFT → SUBMITTED)
router.post("/:id/submit", async (req: AuthRequest, res: Response) => {
  const business = await prisma.business.findUnique({
    where: { userId: req.user!.userId },
  });

  const application = await prisma.loanApplication.findFirst({
    where: { id: req.params.id, businessId: business?.id },
  });

  if (!application) {
    return res
      .status(404)
      .json({ success: false, message: "Application not found" });
  }

  if (application.status !== "DRAFT") {
    return res
      .status(400)
      .json({ success: false, message: "Application already submitted" });
  }

  const updated = await prisma.loanApplication.update({
    where: { id: application.id },
    data: { status: "KYC_PENDING", submittedAt: new Date() },
  });

  audit({ entityType: "LoanApplication", entityId: application.id, action: AuditAction.APPLICATION_SUBMITTED, actorId: req.user!.userId, req });

  // Fire KYC + confirmation email in background (non-blocking)
  const fullApp = await prisma.loanApplication.findUnique({
    where: { id: application.id },
    include: { business: { include: { user: true } } },
  });

  if (fullApp) {
    sendApplicationSubmitted({
      to: fullApp.business.user.email,
      firstName: fullApp.business.user.firstName,
      businessName: fullApp.business.registeredName,
      referenceNumber: fullApp.referenceNumber,
      amountRequested: Number(fullApp.amountRequested),
      tenor: fullApp.tenor,
      systemType: fullApp.systemType,
    }).catch((err) => console.error("Email error:", err));
  }

  runKYCChecks(application.id).catch((err) =>
    console.error("Background KYC error:", err)
  );

  return res.json({ success: true, data: updated });
});

// Get own applications
router.get("/mine", async (req: AuthRequest, res: Response) => {
  const business = await prisma.business.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!business) {
    return res.json({ success: true, data: [] });
  }

  const applications = await prisma.loanApplication.findMany({
    where: { businessId: business.id },
    include: { documents: true, creditProfile: true },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ success: true, data: applications });
});

// Get single application
router.get("/:id", async (req: AuthRequest, res: Response) => {
  const application = await prisma.loanApplication.findUnique({
    where: { id: req.params.id },
    include: {
      business: { include: { directors: true } },
      documents: true,
      kycChecks: true,
      creditProfile: true,
      analystReview: { include: { analyst: { select: { firstName: true, lastName: true, email: true } } } },
    },
  });

  if (!application) {
    return res
      .status(404)
      .json({ success: false, message: "Application not found" });
  }

  // SMEs can only see their own
  if (req.user!.role === "SME_OWNER") {
    const business = await prisma.business.findUnique({
      where: { userId: req.user!.userId },
    });
    if (application.businessId !== business?.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
  }

  return res.json({ success: true, data: application });
});

// Get audit timeline for an application
router.get("/:id/timeline", async (req: AuthRequest, res: Response) => {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: "LoanApplication", entityId: req.params.id },
    orderBy: { createdAt: "asc" },
  });
  return res.json({ success: true, data: logs });
});

// List all applications (analyst/admin)
router.get(
  "/",
  requireRole("ANALYST", "ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = status ? { status: status as any } : {};
    const [applications, total] = await Promise.all([
      prisma.loanApplication.findMany({
        where,
        include: {
          business: { select: { registeredName: true, cacNumber: true, commodities: true, state: true } },
          creditProfile: { select: { totalScore: true, scoreGrade: true, recommendation: true } },
          analystReview: { select: { decision: true, analystId: true } },
        },
        orderBy: { submittedAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.loanApplication.count({ where }),
    ]);

    return res.json({
      success: true,
      data: applications,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  }
);

export default router;

// Background KYC runner — fires after submit, does not block the response
async function runKYCChecks(applicationId: string) {
  const application = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: { business: { include: { directors: true } } },
  });
  if (!application) return;

  const checks: { status: string }[] = [];

  // BVN for each director
  for (const director of application.business.directors) {
    const result = await verifyBVN(director.bvn, director.dateOfBirth || "");
    const status = result.status === "PASSED" ? "PASSED" : result.status === "PENDING" ? "PENDING" : "FAILED";
    checks.push({ status });

    await prisma.director.update({
      where: { id: director.id },
      data: { kycStatus: status as any, kycReference: result.reference },
    });

    await prisma.kYCCheck.create({
      data: {
        businessId: application.businessId,
        applicationId,
        checkType: "BVN",
        provider: "dojah",
        reference: result.reference,
        status: status as any,
        rawResponse: result.details as any,
        notes: result.message,
      },
    });
  }

  // CAC
  const cacResult = await verifyCAC(application.business.cacNumber, application.business.registeredName);
  const cacStatus = cacResult.status === "PASSED" ? "PASSED" : cacResult.status === "PENDING" ? "PENDING" : "FAILED";
  checks.push({ status: cacStatus });

  await prisma.kYCCheck.create({
    data: {
      businessId: application.businessId,
      applicationId,
      checkType: "CAC",
      provider: "dojah",
      reference: cacResult.reference,
      status: cacStatus as any,
      rawResponse: cacResult.details as any,
      notes: cacResult.message,
    },
  });

  // Update application status based on results
  const anyFailed = checks.every((c) => c.status === "FAILED");
  const allPassed = checks.every((c) => c.status === "PASSED");
  const finalStatus = anyFailed ? "KYC_FAILED" : allPassed ? "KYC_VERIFIED" : "KYC_PENDING";

  await prisma.loanApplication.update({
    where: { id: applicationId },
    data: { status: finalStatus as any },
  });

  // Send KYC result email
  const appWithUser = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: { business: { include: { user: true } } },
  });
  if (appWithUser) {
    sendKYCResult({
      to: appWithUser.business.user.email,
      firstName: appWithUser.business.user.firstName,
      referenceNumber: appWithUser.referenceNumber,
      passed: finalStatus === "KYC_VERIFIED",
      details: finalStatus === "KYC_PENDING"
        ? "Some checks are pending provider configuration."
        : undefined,
    }).catch((err) => console.error("KYC email error:", err));
  }
}
