const mongoose = require("mongoose");
const Organization = require("../models/Organization");

async function tenantScope(req, res, next) {
  if (req.user.role === "superadmin") return next();
  if (!req.user.organizationId) {
    return res.status(403).json({ message: "No organization associated with this user" });
  }
  const organization = await Organization.findById(req.user.organizationId);
  if (!organization || organization.isActive === false) {
    return res.status(403).json({ message: "Organization is inactive" });
  }
  if (organization.subscriptionStatus === "cancelled") {
    return res.status(403).json({ message: "Subscription is cancelled" });
  }
  req.orgId = new mongoose.Types.ObjectId(organization._id);
  req.organization = organization;
  next();
}

module.exports = { tenantScope };
