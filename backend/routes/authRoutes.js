const express = require("express");
const { forgotPasswordStatus, googleLogin, login, register, resetPassword } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.get("/forgot-password/status", forgotPasswordStatus);
router.post("/forgot-password/reset", resetPassword);

module.exports = router;
