import rateLimit from "express-rate-limit";

// Basic rate limit for auth routes: 5 requests per minute
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per window
  message: { error: "Too many attempts. Please try again later." },
});
