const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function signAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role, organizationId: user.organizationId }, process.env.JWT_SECRET, { expiresIn: "15m" });
}

function signRefreshToken(user) {
  return jwt.sign({ id: user._id, role: user.role, organizationId: user.organizationId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) };
}

module.exports = { signAccessToken, signRefreshToken, hashResetToken, createPasswordResetToken };
