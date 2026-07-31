const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  plan: { type: String, default: "free" },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Organization", organizationSchema);
