const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  forgotPasswordStatus,
  googleLogin,
  firebaseLogin,
  lookupAccount,
  login,
  register,
  refreshToken,
  requestPasswordReset,
  resetPassword,
} = require("../controllers/authController");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts from this IP. Please try again in 15 minutes." },
});

router.post("/lookup", authLimiter, lookupAccount);
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", refreshToken);
router.post("/google", googleLogin);
router.post("/firebase", authLimiter, firebaseLogin);
router.get("/forgot-password/status", forgotPasswordStatus);
router.post("/forgot-password/request", authLimiter, requestPasswordReset);
router.post("/forgot-password/reset", authLimiter, resetPassword);

module.exports = router;
