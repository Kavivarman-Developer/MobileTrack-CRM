const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing auth token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = decoded.role ? { _id: decoded.id, id: decoded.id, role: decoded.role, organizationId: decoded.organizationId } : null;
    if (!user) user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "Invalid auth token" });

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = { protect };
