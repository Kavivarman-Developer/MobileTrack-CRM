const mongoose = require("mongoose");

function tenantScope(req, res, next) {
  if (req.user.role === "superadmin") return next();
  if (!req.user.organizationId) {
    return res.status(403).json({ message: "No organization associated with this user" });
  }
  req.orgId = new mongoose.Types.ObjectId(req.user.organizationId);
  next();
}

module.exports = { tenantScope };
