const jwt = require("jsonwebtoken");

function signAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role, organizationId: user.organizationId }, process.env.JWT_SECRET, { expiresIn: "15m" });
}

function signRefreshToken(user) {
  return jwt.sign({ id: user._id, role: user.role, organizationId: user.organizationId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

module.exports = { signAccessToken, signRefreshToken };
