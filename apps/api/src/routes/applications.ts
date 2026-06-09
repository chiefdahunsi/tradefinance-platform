import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@tradefinance/db";
import { requireAuth, AuthRequest, requireRole } from "../middleware/auth";

const router = Router();

const applicationSchema = z.object({
  amountRequested: z.number().positive(),
  tenor: z.number().int().min(1).max(24),
  purpose: z.string().min(10),
  commodityType: z.string(),
  tradeDescription: z.string().min(20),
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
    data: { ...parsed.data, businessId: business.id, commodityType: parsed.data.commodityType as any },
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
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

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
          business: { select: { registeredName: true, cacNumber: true, commodities: true } },
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
