const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  plan: { type: String, default: "free" },
  billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
  subscriptionStatus: { type: String, enum: ["trial", "active", "past_due", "cancelled"], default: "trial" },
  subscriptionStartDate: { type: Date, default: Date.now },
  subscriptionEndDate: { type: Date, default: null },
  forgotPasswordEnabled: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Organization", organizationSchema);
