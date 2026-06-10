import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@tradefinance/db";
import { requireAuth, AuthRequest, requireRole } from "../middleware/auth";

const router = Router();

const businessSchema = z.object({
  registeredName: z.string().min(1),
  tradingName: z.string().optional(),
  cacNumber: z.string().min(6),
  taxId: z.string().optional(),
  dateIncorporated: z.string().optional(),
  businessType: z.string(),
  sector: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  website: z.string().url().optional().or(z.literal("")),
  commodities: z.array(z.string()),
  yearsInOperation: z.number().int().optional(),
  annualTurnover: z.number().optional(),
  exportMarkets: z.array(z.string()).optional(),
});

const directorSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  bvn: z.string().length(11),
  nin: z.string().optional(),
  phone: z.string(),
  email: z.string().email(),
  nationality: z.string().optional(),
  percentOwned: z.number().min(0).max(100),
  isSignatory: z.boolean().optional(),
});

router.use(requireAuth);

// Create or update business profile
router.post("/", async (req: AuthRequest, res: Response) => {
  const parsed = businessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const data = parsed.data;
  const userId = req.user!.userId;

  const business = await prisma.business.upsert({
    where: { userId },
    create: {
      ...data,
      userId,
      dateIncorporated: data.dateIncorporated
        ? new Date(data.dateIncorporated)
        : undefined,
    },
    update: {
      ...data,
      dateIncorporated: data.dateIncorporated
        ? new Date(data.dateIncorporated)
        : undefined,
    },
  });

  return res.json({ success: true, data: business });
});

// Get own business
router.get("/me", async (req: AuthRequest, res: Response) => {
  const business = await prisma.business.findUnique({
    where: { userId: req.user!.userId },
    include: { directors: true },
  });
  return res.json({ success: true, data: business });
});

// Add director
router.post("/directors", async (req: AuthRequest, res: Response) => {
  const business = await prisma.business.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!business) {
    return res
      .status(404)
      .json({ success: false, message: "Complete business profile first" });
  }

  const parsed = directorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const director = await prisma.director.create({
    data: { ...parsed.data, businessId: business.id },
  });

  return res.status(201).json({ success: true, data: director });
});

// List all businesses (analyst/admin only)
router.get(
  "/",
  requireRole("ANALYST", "ADMIN"),
  async (_req: AuthRequest, res: Response) => {
    const businesses = await prisma.business.findMany({
      include: { directors: true, _count: { select: { applications: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, data: businesses });
  }
);

export default router;
