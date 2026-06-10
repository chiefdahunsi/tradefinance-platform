import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@tradefinance/db";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { authLimiter, registerLimiter } from "../middleware/rate-limit";
import { audit, AuditAction } from "../services/audit";
import { sendPasswordReset } from "../services/email";

const router = Router();

const smeRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

const analystRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(["ANALYST", "ADMIN"]).default("ANALYST"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function signToken(user: { id: string; email: string; role: string }) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );
}

// Public — SME self-registration (always creates SME_OWNER)
router.post("/register", registerLimiter, async (req: Request, res: Response) => {
  const parsed = smeRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { email, password, firstName, lastName, phone } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return res.status(409).json({ success: false, message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, phone, role: "SME_OWNER" },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  audit({ entityType: "User", entityId: user.id, action: AuditAction.REGISTER, actorId: user.id, actorEmail: user.email, req });

  return res.status(201).json({ success: true, data: { user, token: signToken(user) } });
});

// Admin-only — provision analyst/admin accounts
router.post(
  "/analyst-register",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    const parsed = analystRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    }

    const { email, password, firstName, lastName, phone, role } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, firstName, lastName, phone, role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    return res.status(201).json({ success: true, data: { user } });
  }
);

// SME login — rejects non-SME accounts
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    audit({ entityType: "User", entityId: email, action: AuditAction.LOGIN_FAILED, actorEmail: email, req });
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }

  if (user.role !== "SME_OWNER") {
    return res.status(403).json({
      success: false,
      message: "This portal is for applicants only. Please use the Analyst Portal to sign in.",
    });
  }

  audit({ entityType: "User", entityId: user.id, action: AuditAction.LOGIN_SUCCESS, actorId: user.id, actorEmail: user.email, req });

  return res.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      token: signToken(user),
    },
  });
});

// Analyst login — rejects SME accounts
router.post("/analyst-login", authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    audit({ entityType: "User", entityId: email, action: AuditAction.LOGIN_FAILED, actorEmail: email, req });
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }

  if (user.role !== "ANALYST" && user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "This portal is for analysts only. Please use the Applicant Portal to sign in.",
    });
  }

  audit({ entityType: "User", entityId: user.id, action: AuditAction.LOGIN_SUCCESS, actorId: user.id, actorEmail: user.email, req });

  return res.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      token: signToken(user),
    },
  });
});

// Forgot password — sends reset link (always returns 200 to prevent email enumeration)
router.post("/forgot-password", authLimiter, async (req: Request, res: Response) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Please provide a valid email address." });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const webUrl = process.env.WEB_URL || "http://localhost:3000";
    const resetUrl = `${webUrl}/reset-password?token=${token}`;

    await sendPasswordReset({ to: user.email, firstName: user.firstName, resetUrl });
  }

  // Always respond with success to prevent email enumeration
  return res.json({
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
});

// Reset password — validates token and sets new password
router.post("/reset-password", async (req: Request, res: Response) => {
  const parsed = z.object({
    token: z.string().min(1),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: parsed.data.token,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "This reset link is invalid or has expired. Please request a new one.",
    });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });

  audit({ entityType: "User", entityId: user.id, action: "PASSWORD_RESET", actorId: user.id, actorEmail: user.email, req });

  return res.json({ success: true, message: "Password reset successfully. You can now sign in." });
});

export default router;
