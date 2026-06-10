import rateLimit from "express-rate-limit";

// Strict limit for login attempts — prevent brute force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please wait 15 minutes before trying again." },
  skip: () => process.env.NODE_ENV === "test",
});

// Registration limit — prevent spam accounts
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many registration attempts. Please try again in an hour." },
  skip: () => process.env.NODE_ENV === "test",
});

// General API limit — prevent abuse
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
  skip: () => process.env.NODE_ENV === "test",
});

// Upload limit — prevent storage abuse
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many uploads. Please try again later." },
  skip: () => process.env.NODE_ENV === "test",
});
