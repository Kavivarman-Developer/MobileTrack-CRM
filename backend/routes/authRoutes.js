const express = require("express");
const rateLimit = require("express-rate-limit");
const { forgotPasswordStatus, googleLogin, login, register, requestPasswordReset, resetPassword } = require("../controllers/authController");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts from this IP. Please try again in 15 minutes." },
});

router.post("/register", register);
router.post("/login", authLimiter, login);
router.post("/google", googleLogin);
router.get("/forgot-password/status", forgotPasswordStatus);
router.post("/forgot-password/request", authLimiter, requestPasswordReset);
router.post("/forgot-password/reset", authLimiter, resetPassword);

module.exports = router;
